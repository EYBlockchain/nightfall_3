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

const { USE_STUBS } = global.config;
const { SHIELD_CONTRACT_NAME } = global.nightfallConstants;
const { generalise } = gen;

const circuitName = USE_STUBS ? 'transfer_stub' : 'transfer';

const NULL_COMMITMENT_INFO = {
  oldCommitments: [],
  nullifiers: [],
  newCommitments: [],
  localSiblingPaths: [],
  leafIndices: [],
  blockNumberL2s: [],
  roots: [],
  salts: [],
};

async function transfer(transferParams, shieldContractAddress) {
  logger.info('Creating a transfer transaction');
  // let's extract the input items
  const { ...items } = transferParams;
  const { ercAddress, tokenId, recipientData, rootKey, fee = generalise(0) } = generalise(items);
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

    const addedFee = maticAddress.hex(32) === ercAddress.hex(32) ? fee.bigInt : 0n;

    const totalValueToSend = values.reduce((acc, value) => acc + value.bigInt, 0n);
    const commitmentsInfo = await getCommitmentInfo({
      transferValue: totalValueToSend,
      addedFee,
      recipientZkpPublicKeysArray: recipientZkpPublicKeys,
      ercAddress,
      tokenId,
      rootKey,
    });
    const commitmentsInfoFee =
      fee.bigInt === 0n || commitmentsInfo.feeIncluded
        ? NULL_COMMITMENT_INFO
        : await getCommitmentInfo({
            transferValue: fee.bigInt,
            ercAddress: maticAddress,
            rootKey,
          }).catch(async () => {
            await Promise.all(commitmentsInfo.oldCommitments.map(o => clearPending(o)));
            throw new Error('Failed getting fee commitments');
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
        historicRootBlockNumberL2: [
          ...commitmentsInfo.blockNumberL2s,
          ...commitmentsInfoFee.blockNumberL2s,
        ],
        transactionType: 1,
        ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
        tokenId: compressedSecrets[1], // this is the encrypted tokenID
        recipientAddress: compressedEPub,
        commitments: [...commitmentsInfo.newCommitments, ...commitmentsInfoFee.newCommitments],
        nullifiers: [...commitmentsInfo.nullifiers, ...commitmentsInfoFee.nullifiers],
        compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
      });

      const privateData = {
        rootKey: [rootKey, rootKey, rootKey, rootKey],
        oldCommitmentPreimage: [
          ...commitmentsInfo.oldCommitments,
          ...commitmentsInfoFee.oldCommitments,
        ].map(o => {
          return { value: o.preimage.value, salt: o.preimage.salt };
        }),
        paths: [...commitmentsInfo.localSiblingPaths, ...commitmentsInfoFee.localSiblingPaths].map(
          siblingPath => siblingPath.slice(1),
        ),
        orders: [...commitmentsInfo.leafIndices, ...commitmentsInfoFee.leafIndices],
        newCommitmentPreimage: [
          ...commitmentsInfo.newCommitments,
          ...commitmentsInfoFee.newCommitments,
        ].map(o => {
          return { value: o.preimage.value, salt: o.preimage.salt };
        }),
        recipientPublicKeys: [
          ...commitmentsInfo.newCommitments,
          ...commitmentsInfoFee.newCommitments,
        ].map(o => o.preimage.zkpPublicKey),
        ercAddress,
        tokenId,
        ephemeralKey: ePrivate,
      };

      const witnessInput = computeCircuitInputs(
        transaction,
        privateData,
        [...commitmentsInfo.roots, ...commitmentsInfoFee.roots],
        maticAddress,
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
      const artifacts = { program: new Uint8Array(program), abi };
      const keypair = { pk: new Uint8Array(pk) };
      console.log('Computing witness');
      const { witness } = zokratesProvider.computeWitness(artifacts, witnessInput);
      // generate proof
      console.log('Generating Proof');
      let { proof } = zokratesProvider.generateProof(artifacts.program, witness, keypair.pk);
      console.log('Proof Generated');
      proof = [...proof.a, ...proof.b, ...proof.c];
      proof = proof.flat(Infinity);
      // and work out the ABI encoded data that the caller should sign and send to the shield contract
      const optimisticTransferTransaction = new Transaction({
        fee,
        historicRootBlockNumberL2: [
          ...commitmentsInfo.blockNumberL2s,
          ...commitmentsInfoFee.blockNumberL2s,
        ],
        transactionType: 1,
        ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
        tokenId: compressedSecrets[1], // this is the encrypted tokenID
        recipientAddress: compressedEPub,
        commitments: [...commitmentsInfo.newCommitments, ...commitmentsInfoFee.newCommitments],
        nullifiers: [...commitmentsInfo.nullifiers, ...commitmentsInfoFee.nullifiers],
        compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
        proof,
      });

      const { compressedZkpPublicKey, nullifierKey } = new ZkpKeys(rootKey);

      const rawTransaction = await shieldContractInstance.methods
        .submitTransaction(Transaction.buildSolidityStruct(optimisticTransferTransaction))
        .encodeABI();
      // Store new commitments that are ours.
      const storeNewCommitments = [
        ...commitmentsInfo.newCommitments,
        ...commitmentsInfoFee.newCommitments,
      ]
        .filter(c => c.compressedZkpPublicKey.hex(32) === compressedZkpPublicKey.hex(32))
        .map(c => storeCommitment(c, nullifierKey));
      const nullifyOldCommitments = [
        ...commitmentsInfo.oldCommitments,
        ...commitmentsInfoFee.oldCommitments,
      ].map(c => markNullified(c, optimisticTransferTransaction));
      await Promise.all([...storeNewCommitments, ...nullifyOldCommitments]);
      return {
        rawTransaction,
        transaction: optimisticTransferTransaction,
      };
    } catch (err) {
      await Promise.all(
        [...commitmentsInfo.oldCommitments, ...commitmentsInfoFee.oldCommitments].map(commitment =>
          clearPending(commitment),
        ),
      );
      throw new Error(err);
    }
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}

export default transfer;
