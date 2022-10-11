/* ignore unused exports */

/**
This module contains the logic needed create a zkp transfer, i.e. to nullify
two input commitments and create two new output commitments to the same value.
It is agnostic to whether we are dealing with an ERC20 or ERC721 (or ERC1155).
 * @module deposit
 * @author westlad, ChaitanyaKonda, iAmMichaelConnor, will-kim
 */

import gen from 'general-number';
import { initialize } from 'zokrates-js';

import * as snarkjs from 'snarkjs';
import confirmBlock from './confirm-block';
import computeCircuitInputs from '../utils/compute-witness';
import getCommitmentInfo from '../utils/getCommitmentInfo';
import { getContractInstance } from '../../common-files/utils/contract';
import logger from '../../common-files/utils/logger';
import { Transaction } from '../classes/index';
import { edwardsCompress } from '../../common-files/utils/curve-maths/curves';
import { ZkpKeys } from './keys';
import {
  checkIndexDBForCircuit,
  getStoreCircuit,
  getLatestTree,
  getMaxBlock,
  emptyStoreBlocks,
  emptyStoreTimber,
} from './database';
import { encrypt, genEphemeralKeys, packSecrets } from './kem-dem';
import { clearPending, markNullified, storeCommitment } from './commitment-storage';

const { USE_STUBS, VK_IDS } = global.config;
const { SHIELD_CONTRACT_NAME } = global.nightfallConstants;
const { generalise } = gen;

const circuitName = USE_STUBS ? 'transfer_stub' : 'transfer';

async function transfer(transferParams, shieldContractAddress) {
  logger.info('Creating a transfer transaction');
  // let's extract the input items
  const { ...items } = transferParams;
  const { tokenId, recipientData, rootKey, fee = generalise(0) } = generalise(items);

  const ercAddress = generalise(items.ercAddress.toLowerCase());
  const { recipientCompressedZkpPublicKeys, values } = recipientData;
  const recipientZkpPublicKeys = recipientCompressedZkpPublicKeys.map(key =>
    ZkpKeys.decompressZkpPublicKey(key),
  );
  if (recipientCompressedZkpPublicKeys.length > 1)
    throw new Error(`Batching is not supported yet: only one recipient is allowed`); // this will not always be true so we try to make the following code agnostic to the number of commitments

  const lastTree = await getLatestTree();
  const lastBlockNumber = await getMaxBlock();

  try {
    await confirmBlock(lastBlockNumber, lastTree);
  } catch (err) {
    emptyStoreBlocks();
    emptyStoreTimber();
    console.log('Resync Done Transfer');
    throw new Error(err);
  }

  try {
    const shieldContractInstance = await getContractInstance(
      SHIELD_CONTRACT_NAME,
      shieldContractAddress,
    );

    const maticAddress = generalise(
      (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
    );

    const totalValueToSend = values.reduce((acc, value) => acc + value.bigInt, 0n);
    const commitmentsInfo = await getCommitmentInfo({
      totalValueToSend,
      fee: fee.bigInt,
      recipientZkpPublicKeysArray: recipientZkpPublicKeys,
      ercAddress,
      maticAddress,
      tokenId,
      rootKey,
      maxNumberNullifiers: VK_IDS.transfer.numberNullifiers,
    });

    try {
      // KEM-DEM encryption
      const [ePrivate, ePublic] = await genEphemeralKeys();
      const [unpackedTokenID, packedErc] = packSecrets(tokenId, ercAddress, 0, 2);
      const compressedSecrets = encrypt(
        generalise(ePrivate),
        generalise(recipientZkpPublicKeys[0]),
        [
          packedErc.bigInt,
          unpackedTokenID.bigInt,
          values[0].bigInt,
          commitmentsInfo.salts[0].bigInt,
        ],
      );

      // Compress the public key as it will be put on-chain
      const compressedEPub = edwardsCompress(ePublic);

      // now we have everything we need to create a Witness and compute a proof
      const transaction = new Transaction({
        fee,
        historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
        transactionType: 1,
        ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
        tokenId: compressedSecrets[1], // this is the encrypted tokenID
        recipientAddress: compressedEPub,
        commitments: commitmentsInfo.newCommitments,
        nullifiers: commitmentsInfo.nullifiers,
        compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
        numberNullifiers: VK_IDS.transfer.numberNullifiers,
        numberCommitments: VK_IDS.transfer.numberCommitments,
      });

      const privateData = {
        rootKey,
        oldCommitmentPreimage: commitmentsInfo.oldCommitments.map(o => {
          return { value: o.preimage.value, salt: o.preimage.salt };
        }),
        paths: commitmentsInfo.localSiblingPaths.map(siblingPath => siblingPath.slice(1)),
        orders: commitmentsInfo.leafIndices,
        newCommitmentPreimage: commitmentsInfo.newCommitments.map(o => {
          return { value: o.preimage.value, salt: o.preimage.salt };
        }),
        recipientPublicKeys: commitmentsInfo.newCommitments.map(o => o.preimage.zkpPublicKey),
        ercAddress,
        tokenId,
        ephemeralKey: ePrivate,
      };

      const witnessInput = computeCircuitInputs(
        transaction,
        privateData,
        commitmentsInfo.roots,
        maticAddress,
        VK_IDS.transfer.numberNullifiers,
        VK_IDS.transfer.numberCommitments,
      );

      // call a zokrates worker to generate the proof
      // This is (so far) the only place where we need to get specific about the
      // circuit
      if (!(await checkIndexDBForCircuit(circuitName)))
        throw Error('Some circuit data are missing from IndexedDB');
      const [abiData, programData, pkData] = await Promise.all([
        getStoreCircuit(`${circuitName}-abi`),
        getStoreCircuit(`${circuitName}-program`),
        getStoreCircuit(`${circuitName}-pk`),
      ]);
      const abi = abiData.data;
      const program = programData.data;
      const pk = pkData.data;

      const zokratesProvider = await initialize();
      const artifacts = {
        program: new Uint8Array(program),
        abi: { inputs: abi.inputs, outputs: [abi.output] },
      };
      const keypair = { pk: new Uint8Array(pk) };
      console.log('Computing witness');
      const witnessInfo = zokratesProvider.computeWitness(artifacts, witnessInput, {
        snarkjs: true,
      });

      // generate proof
      console.log('Generating Proof');
      const prove = await snarkjs.groth16.prove(keypair, witnessInfo.snarkjs.witness); // zkey, witness
      const { proof } = prove;
      console.log('Proof Generated');
      // and work out the ABI encoded data that the caller should sign and send to the shield contract
      const optimisticTransferTransaction = new Transaction({
        fee,
        historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
        transactionType: 1,
        ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
        tokenId: compressedSecrets[1], // this is the encrypted tokenID
        recipientAddress: compressedEPub,
        commitments: commitmentsInfo.newCommitments,
        nullifiers: commitmentsInfo.nullifiers,
        compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
        proof,
        numberNullifiers: VK_IDS.transfer.numberNullifiers,
        numberCommitments: VK_IDS.transfer.numberCommitments,
      });

      const { compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);

      const rawTransaction = await shieldContractInstance.methods
        .submitTransaction(Transaction.buildSolidityStruct(optimisticTransferTransaction))
        .encodeABI();
      // Store new commitments that are ours.
      const storeNewCommitments = commitmentsInfo.newCommitments
        .filter(c => c.compressedZkpPublicKey.hex(32) === compressedZkpPublicKey.hex(32))
        .map(c => storeCommitment(c, nullifierKey));

      const nullifyOldCommitments = commitmentsInfo.oldCommitments.map(c =>
        markNullified(c, optimisticTransferTransaction),
      );
      await Promise.all([...storeNewCommitments, ...nullifyOldCommitments]);
      return {
        rawTransaction,
        transaction: optimisticTransferTransaction,
      };
    } catch (err) {
      await Promise.all(commitmentsInfo.oldCommitments.map(o => clearPending(o)));
      throw new Error(err);
    }
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}

export default transfer;
