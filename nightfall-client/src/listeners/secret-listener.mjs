import config from 'config';
import { generalise, GN } from 'general-number';
import { dec, edwardsDecompress } from '../utils/crypto/encryption/elgamal.mjs';
import { getContractInstance, getContractAddress } from '../utils/contract.mjs';
import logger from '../utils/logger.mjs';
import { subscribeToEvent } from '../services/event.mjs';
import { calculatePkd } from '../services/keys.mjs';
import Commitment from '../classes/commitment.mjs';
import { storeCommitment } from '../services/commitment-storage.mjs';
import mongo from '../utils/mongo.mjs';

const {
  STATE_CONTRACT_NAME,
  BLOCK_PROPOSED_EVENT_NAME,
  FROM_BLOCK,
  MONGO_URL,
  COMMITMENTS_DB,
  COMMITMENTS_COLLECTION,
} = config;

// function to decrypt secret data and store decrypted data received by the recipient of a token transfer
export async function onReceiptSecrets(eventData, ivk) {
  const { returnValues } = eventData;
  const encryptedSecrets = generalise(returnValues.encryptedSecrets).map(encryptedSecret => {
    return edwardsDecompress(encryptedSecret.bigInt);
  });
  const decryptedMessages = dec(encryptedSecrets, ivk);
  const ercAddress = decryptedMessages[0];
  const tokenId = decryptedMessages[1];
  const value = decryptedMessages[2];
  const salt = decryptedMessages[3];
  const { pkd, compressedPkd } = await calculatePkd(new GN(ivk));
  const commitment = new Commitment({
    compressedPkd,
    pkd,
    ercAddress,
    tokenId,
    value,
    salt,
  });
  await storeCommitment(commitment, true);
}

// function to start the secret listener to listen to a shield contract for specific events such as transfers
export async function startSecretListener(ivk) {
  logger.info(`\nSubscribing to event...`);
  logger.info(`contractName ${STATE_CONTRACT_NAME}`);
  logger.info(`eventName ${BLOCK_PROPOSED_EVENT_NAME}`);
  logger.info(`fromBlock ${FROM_BLOCK}`);

  const deployedAddress = await getContractAddress(STATE_CONTRACT_NAME);
  const contractInstance = await getContractInstance(STATE_CONTRACT_NAME, deployedAddress);

  subscribeToEvent(contractInstance, BLOCK_PROPOSED_EVENT_NAME, FROM_BLOCK, onReceiptSecrets, [
    ivk,
  ]);
}

// function to retrieve the last block that a user was a recipient of a token transfer
export async function getLastBlockSynced() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find()
    .sort({ blockNumber: -1 })
    .limit(1);
  return commitments;
}

// function to retrieve commitments within a block range received as a recipient of a token transfer
export async function getCommitmentsWithinBlockRange(startBlock, endBlock) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({ blockNumber: { $gte: startBlock, $lte: endBlock } });
  return commitments;
}

// function to retrieve commitment with a specified salt
export async function getCommitmentWithSalt(salt) {
  const saltGN = generalise(salt); // sometimes this is sent as a BigInt.
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({ 'preimage.salt': saltGN.hex(32) })
    .toArray();
  return commitments;
}
