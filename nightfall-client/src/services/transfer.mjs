/**
 * This module contains the logic needed create a zkp transfer, i.e. to nullify
 * two input commitments and create two new output commitments to the same value.
 * It is agnostic to whether we are dealing with an ERC20 or ERC721 (or ERC1155).
 * @module deposit.mjs
 * @author westlad, ChaitanyaKonda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import gen from 'general-number';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { edwardsCompress } from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import {
  getCircuitHash,
  generateProof,
} from '@polygon-nightfall/common-files/utils/worker-calls.mjs';
import { Transaction } from '../classes/index.mjs';
import { ZkpKeys } from './keys.mjs';
import { computeCircuitInputs } from '../utils/computeCircuitInputs.mjs';
import { encrypt, genEphemeralKeys, packSecrets } from './kem-dem.mjs';
import { clearPending } from './commitment-storage.mjs';
import { getCommitmentInfo } from '../utils/getCommitmentInfo.mjs';
import { submitTransaction } from '../utils/submitTransaction.mjs';

const { VK_IDS } = config;
const { SHIELD_CONTRACT_NAME } = constants;
const { generalise } = gen;

async function transfer(transferParams) {
  logger.info('Creating a transfer transaction');
  // let's extract the input items
  const { offchain = false, providedCommitments, ...items } = transferParams;
  const { tokenId, recipientData, rootKey, fee } = generalise(items);
  const ercAddress = generalise(items.ercAddress.toLowerCase());
  const { recipientCompressedZkpPublicKeys, values } = recipientData;
  const recipientZkpPublicKeys = recipientCompressedZkpPublicKeys.map(key =>
    ZkpKeys.decompressZkpPublicKey(key),
  );
  if (recipientCompressedZkpPublicKeys.length > 1)
    throw new Error(`Batching is not supported yet: only one recipient is allowed`); // this will not always be true so we try to make the following code agnostic to the number of commitments

  const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

  const maticAddress = generalise(
    (await shieldContractInstance.methods.getMaticAddress().call()).toLowerCase(),
  );

  logger.debug({
    msg: 'Transfer ERC Token & Fee addresses',
    ercAddress: ercAddress.hex(32),
    maticAddress: maticAddress.hex(32),
  });

  const totalValueToSend = values.reduce((acc, value) => acc + value.bigInt, 0n);
  const commitmentsInfo = await getCommitmentInfo({
    totalValueToSend,
    fee,
    recipientZkpPublicKeysArray: recipientZkpPublicKeys,
    ercAddress,
    maticAddress,
    tokenId,
    rootKey,
    maxNullifiers: VK_IDS.transfer.numberNullifiers,
    providedCommitments,
  });

  try {
    // KEM-DEM encryption
    const [ePrivate, ePublic] = await genEphemeralKeys();
    const [unpackedTokenID, packedErc] = packSecrets(tokenId, ercAddress, 0, 2);
    const compressedSecrets = encrypt(generalise(ePrivate), generalise(recipientZkpPublicKeys[0]), [
      packedErc.bigInt,
      unpackedTokenID.bigInt,
      values[0].bigInt,
      commitmentsInfo.salts[0].bigInt,
    ]);

    // Compress the public key as it will be put on-chain
    const compressedEPub = edwardsCompress(ePublic);

    const circuitHash = await getCircuitHash('transfer');

    // now we have everything we need to create a Witness and compute a proof
    const publicData = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      circuitHash,
      ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
      tokenId: compressedEPub,
      recipientAddress: compressedSecrets[1], // this is the encrypted tokenID
      commitments: commitmentsInfo.newCommitments,
      nullifiers: commitmentsInfo.nullifiers,
      compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
      numberNullifiers: VK_IDS.transfer.numberNullifiers,
      numberCommitments: VK_IDS.transfer.numberCommitments,
      isOnlyL2: true,
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

    const witness = computeCircuitInputs(
      publicData,
      privateData,
      commitmentsInfo.roots,
      maticAddress,
      VK_IDS.transfer.numberNullifiers,
      VK_IDS.transfer.numberCommitments,
    );

    logger.debug({
      msg: 'witness input is',
      witness: JSON.stringify(witness, 0, 2),
    });

    // call a worker to generate the proof
    const res = await generateProof({ folderpath: 'transfer', witness });

    logger.trace({
      msg: 'Received response from generate-proof',
      response: JSON.stringify(res.data, null, 2),
    });

    const { proof } = res.data;
    // and work out the ABI encoded data that the caller should sign and send to the shield contract

    const transaction = new Transaction({
      fee,
      historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
      circuitHash,
      ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
      tokenId: compressedEPub, // this is the encrypted tokenID
      recipientAddress: compressedSecrets[1],
      commitments: commitmentsInfo.newCommitments,
      nullifiers: commitmentsInfo.nullifiers,
      compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
      proof,
      numberNullifiers: VK_IDS.transfer.numberNullifiers,
      numberCommitments: VK_IDS.transfer.numberCommitments,
      isOnlyL2: true,
    });

    logger.debug({
      msg: 'Client made transaction',
      transaction,
      offchain,
    });

    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(transaction))
      .encodeABI();
    await submitTransaction(transaction, commitmentsInfo, rootKey, offchain);

    return { rawTransaction, transaction };
  } catch (error) {
    await Promise.all(commitmentsInfo.oldCommitments.map(o => clearPending(o)));
    throw new Error(error);
  }
}

export default transfer;
