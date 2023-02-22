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
import {
  edwardsCompress,
  compressProof,
} from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import {
  waitForContract,
  getFeeL2TokenAddress,
} from '@polygon-nightfall/common-files/utils/contract.mjs';
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
const { SHIELD_CONTRACT_NAME, TRANSFER } = constants;
const { generalise } = gen;

const circuitName = TRANSFER;

/**
 * Does some sort of treatment and validations in the parameters so that they can be used properly
 */
async function getTransferParams(transferParams) {
  const {
    offchain = false,
    providedCommitments,
    providedCommitmentsFee,
    ...items
  } = transferParams;
  const generalisedItems = generalise(items);
  const { compressedZkpPublicKey, nullifierKey } = new ZkpKeys(generalisedItems.rootKey);
  const { recipientCompressedZkpPublicKeys, values } = generalisedItems.recipientData;

  if (recipientCompressedZkpPublicKeys.length > 1)
    throw new Error(`Batching is not supported yet: only one recipient is allowed`); // this will not always be true so we try to make the following code agnostic to the number of commitments

  const recipientZkpPublicKeys = recipientCompressedZkpPublicKeys.map(key =>
    ZkpKeys.decompressZkpPublicKey(key),
  );

  const totalValueToSend = values.reduce((acc, value) => acc + value.bigInt, 0n);

  return {
    offchain,
    providedCommitments,
    providedCommitmentsFee,
    tokenId: generalisedItems.tokenId,
    rootKey: generalisedItems.rootKey,
    fee: generalisedItems.fee,
    feeL2TokenAddress: await getFeeL2TokenAddress(),
    ercAddress: generalise(items.ercAddress.toLowerCase()),
    compressedZkpPublicKey,
    nullifierKey,
    values,
    totalValueToSend,
    recipientZkpPublicKeys,
  };
}

/**
 * Returns the publicData along with the generated compressed proof for the transfer
 */
async function generateTransferProof(
  fee,
  feeL2TokenAddress,
  tokenId,
  ercAddress,
  recipientZkpPublicKeys,
  rootKey,
  values,
  commitmentsInfo,
) {
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

  // now we have everything we need to create a Witness and compute a proof
  const publicData = new Transaction({
    fee,
    historicRootBlockNumberL2: commitmentsInfo.blockNumberL2s,
    circuitHash: await getCircuitHash(circuitName),
    ercAddress: compressedSecrets[0], // this is the encrypted ercAddress
    tokenId: compressedEPub,
    recipientAddress: compressedSecrets[1], // this is the encrypted tokenID
    commitments: commitmentsInfo.newCommitments,
    nullifiers: commitmentsInfo.nullifiers,
    compressedSecrets: compressedSecrets.slice(2), // these are the [value, salt]
    numberNullifiers: VK_IDS[circuitName].numberNullifiers,
    numberCommitments: VK_IDS[circuitName].numberCommitments,
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
    feeL2TokenAddress,
    VK_IDS[circuitName].numberNullifiers,
    VK_IDS[circuitName].numberCommitments,
  );

  logger.debug({
    msg: 'witness input is',
    witness,
  });

  // call a worker to generate the proof
  const res = await generateProof({ folderpath: circuitName, witness });

  logger.trace({
    msg: 'Received response from generate-proof',
    response: res.data,
  });

  const { proof } = res.data;

  return { proof: compressProof(proof), publicData };
}

/**
 * Transfers funds between Nightfall Accounts.
 */
async function transfer(transferParams) {
  logger.info('Creating a transfer transaction');

  const {
    offchain,
    providedCommitments,
    providedCommitmentsFee,
    tokenId,
    rootKey,
    fee,
    feeL2TokenAddress,
    ercAddress,
    compressedZkpPublicKey,
    nullifierKey,
    values,
    totalValueToSend,
    recipientZkpPublicKeys,
  } = await getTransferParams(transferParams);

  logger.debug({
    msg: 'Transfer ERC Token & Fee addresses',
    ercAddress: ercAddress.hex(32),
    feeL2TokenAddress: feeL2TokenAddress.hex(32),
  });

  const commitmentsInfo = await getCommitmentInfo({
    totalValueToSend,
    fee,
    recipientZkpPublicKeysArray: recipientZkpPublicKeys,
    ercAddress,
    feeL2TokenAddress,
    tokenId,
    rootKey,
    maxNullifiers: VK_IDS[circuitName].numberNullifiers,
    providedCommitments,
    providedCommitmentsFee,
  });

  try {
    const { proof, publicData } = await generateTransferProof(
      fee,
      feeL2TokenAddress,
      tokenId,
      ercAddress,
      recipientZkpPublicKeys,
      rootKey,
      values,
      commitmentsInfo,
    );

    const transaction = { ...publicData, proof };
    transaction.transactionHash = Transaction.calcHash(transaction);

    logger.debug({
      msg: `Client made ${circuitName}`,
      transaction,
      offchain,
    });

    const shieldContractInstance = await waitForContract(SHIELD_CONTRACT_NAME);

    const rawTransaction = await shieldContractInstance.methods
      .submitTransaction(Transaction.buildSolidityStruct(transaction))
      .encodeABI();

    await submitTransaction(
      transaction,
      commitmentsInfo,
      compressedZkpPublicKey,
      nullifierKey,
      offchain,
    );

    return { rawTransaction, transaction };
  } catch (error) {
    await Promise.all(commitmentsInfo.oldCommitments.map(o => clearPending(o))); // TODO this can be improved to be done all at once (via query mongoDB)!
    logger.error(error);
    throw error;
  }
}

export default transfer;
