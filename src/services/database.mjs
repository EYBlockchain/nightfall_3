/**
Functions for storing blockchain data that the optimist application needs to
remember wholesale because otherwise it would have to be constructed in real-
time from blockchain events.
*/
import config from 'config';
import mongo from '../utils/mongo.mjs';
import logger from '../utils/logger.mjs';

const {
  MONGO_URL,
  OPTIMIST_DB,
  UNPROCESSED_TRANSACTIONS_COLLECTION,
  METADATA_COLLECTION,
  SUBMITTED_BLOCKS_COLLECTION,
} = config;

/**
function to save a block, so that we can later search the block, for example to
find which block a transaction went into. Note, we'll save all blocks, that get
posted to the blockchain, not just ours, although that may not be needed (but
they're small).
*/
export async function saveBlock(block) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  logger.debug(`saving block ${JSON.stringify(block, null, 2)}`);
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).insertOne(block);
}

/**
function to search the submitted blocks collection by transaction hash. This is
useful for finding which block a transaction was in (something we have no
control over, because another Proposer may assemble one of our transactions
into a block).
*/
export async function getBlock(transactionHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { transactionHashes: transactionHash };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).findOne(query);
}

/**
function to store addresses of proposers that are registered through this
app. These are needed because the app needs to know when one of them is the
current (active) proposer, at which point it will automatically start to
assemble blocks on behalf of the proposer. It listens for the NewCurrentProposer
event to determine who is the current proposer.
*/
export async function setRegisteredProposerAddress(address) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  logger.debug(`Saving proposer address ${address}`);
  const data = { proposer: address };
  return db.collection(METADATA_COLLECTION).insertOne(data);
}

/**
Function to check if the current proposer (as signalled by the NewCurrentProposer blockchain event) is registered through this application, and
thus it should start assembling blocks of transactions.
*/
export async function isRegisteredProposerAddressMine(address) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const metadata = await db.collection(METADATA_COLLECTION).findOne({ proposer: address });
  logger.silly(`found registered proposer ${JSON.stringify(metadata, null, 2)}`);
  return metadata !== null;
}

/**
Function to return 'number' transactions, ordered by the highest fee. If there
are fewer than 'number' transactions, all are returned.
*/
export async function getMostProfitableTransactions(number) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db
    .collection(UNPROCESSED_TRANSACTIONS_COLLECTION)
    .find({}, { limit: number, sort: { fee: -1 }, projection: { _id: 0 } })
    .toArray();
}

/**
Function to save a (unprocessed) Transaction
*/
export async function saveTransaction(transaction) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db.collection(UNPROCESSED_TRANSACTIONS_COLLECTION).insertOne(transaction);
}

/**
Function to remove a set of transactions once they've been processed into a
block
*/
export async function removeTransactions(block) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { transactionHash: { $in: block.transactionHashes } };
  return db.collection(UNPROCESSED_TRANSACTIONS_COLLECTION).deleteMany(query);
}

/**
How many transactions are waiting to be processed into a block?
*/
export async function numberOfUnprocessedTransactions() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db.collection(UNPROCESSED_TRANSACTIONS_COLLECTION).countDocuments();
}
