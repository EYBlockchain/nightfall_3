/**
Functions for storing blockchain data that the optimist application needs to
remember wholesale because otherwise it would have to be constructed in real-
time from blockchain events.
*/
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import mongo from 'common-files/utils/mongo.mjs';

const {
  MONGO_URL,
  OPTIMIST_DB,
  TRANSACTIONS_COLLECTION,
  METADATA_COLLECTION,
  SUBMITTED_BLOCKS_COLLECTION,
  NULLIFIER_COLLECTION,
  COMMIT_COLLECTION,
} = config;

/**
Function to save a commit, used in a challenge commit-reveal process
*/
export async function saveCommit(commitHash, txDataToSign) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  logger.debug(`saving commit hash ${commitHash}`);
  return db.collection(COMMIT_COLLECTION).insertOne({ commitHash, txDataToSign });
}
/**
Function to retrieve a commit, by commitHash
*/
export async function getCommit(commitHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { commitHash };
  return db.collection(COMMIT_COLLECTION).findOne(query);
}

/**
function to store addresses that are used to sign challenge transactions.  This
is done so that we can check that a challenge commit is from us and hasn't been
front-run (because that would change the origin address of the commit to that of
the front-runner).
*/
export async function addChallengerAddress(address) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  logger.debug(`Saving proposer address ${address}`);
  const data = { challenger: address };
  return db.collection(METADATA_COLLECTION).insertOne(data);
}

/**
function to remove addresses that are used to sign challenge transactions. This
is needed in the case of a key compromise, or if we simply no longer wish to use
the address.
*/
export async function removeChallengerAddress(address) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  logger.debug(`Saving proposer address ${address}`);
  const data = { challenger: address };
  return db.collection(METADATA_COLLECTION).deleteOne(data);
}

/**
Function to tell us if an address used to commit to a challenge belongs to us
*/
export async function isChallengerAddressMine(address) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const metadata = await db.collection(METADATA_COLLECTION).findOne({ challenger: address });
  return metadata !== null;
}

/**
function to save a block, so that we can later search the block, for example to
find which block a transaction went into. Note, we'll save all blocks, that get
posted to the blockchain, not just ours.
*/
export async function saveBlock(_block) {
  const block = { _id: _block.blockHash, ..._block };
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
export async function getBlockByTransactionHash(transactionHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { transactionHashes: transactionHash };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).findOne(query);
}

export async function numberOfBlockWithTransactionHash(transactionHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { transactionHashes: transactionHash };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).countDocuments(query);
}

/**
function to get a block by blockHash, if you know the hash of the block. This
is useful for rolling back Timber.
*/
export async function getBlockByBlockHash(blockHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { blockHash };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).findOne(query);
}

/**
function to get a block by root, if you know the root of the block. This
is useful for nightfall-client to establish the layer block number containing
a given (historic) root.
*/
export async function getBlockByRoot(root) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { root };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).findOne(query);
}

/**
function to get a block by blockNumberL2, if you know the number of the block. This is useful for rolling back Timber.
*/
export async function getBlockByBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { blockNumberL2: Number(blockNumberL2) };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).findOne(query);
}

/**
function to delete a block. This is useful after a rollback event, whereby the
block no longer exists
*/
export async function deleteBlock(blockHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { blockHash };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).deleteOne(query);
}

/**
function to delete blocks with a layer 1 block number >= blockNumber
*/
export async function deleteBlocksFromBlockNumberL1(blockNumber) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { blockNumber: { $gte: Number(blockNumber) } };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).deleteMany(query);
}

/**
function to find blocks with a layer 2 blockNumber >= blockNumberL2
*/
export async function findBlocksFromBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { blockNumberL2: { $gte: Number(blockNumberL2) } };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).find(query).toArray();
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
  return metadata;
}

/**
Function to return 'number' transactions, ordered by the highest fee. If there
are fewer than 'number' transactions, all are returned.
*/
export async function getMostProfitableTransactions(number) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db
    .collection(TRANSACTIONS_COLLECTION)
    .find({ mempool: true }, { limit: number, sort: { fee: -1 }, projection: { _id: 0 } })
    .toArray();
}

/**
Function to save a (unprocessed) Transaction
*/
export async function saveTransaction(_transaction) {
  const transaction = { _id: _transaction.transactionHash, ..._transaction, mempool: true };
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db.collection(TRANSACTIONS_COLLECTION).insertOne(transaction);
}

/**
Function to add a set of transactions from the layer 2 mempool once a block has been rolled back
*/
export async function addTransactionsToMemPool(block) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const searchQuery = { transactionHash: { $in: block.transactionHashes } };
  const transactions = await db.collection(TRANSACTIONS_COLLECTION).find(searchQuery).toArray();
  // This filters out any transactions that may been included in other blocks
  const transactionUniqueToBlock = transactions
    .filter(t => t.blockNumberL2 === block.blockNumberL2)
    .map(t => t.transactionHash);
  const updateQuery = { transactionHash: { $in: transactionUniqueToBlock } };
  const update = { $set: { mempool: true, blockNumberL2: -1 } };
  return db.collection(TRANSACTIONS_COLLECTION).updateMany(updateQuery, update);
}

/**
Function to remove a set of transactions from the layer 2 mempool once they've
been processed into a block
*/
export async function removeTransactionsFromMemPool(block) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { transactionHash: { $in: block.transactionHashes } };
  const update = { $set: { mempool: false, blockNumberL2: block.blockNumberL2 } };
  return db.collection(TRANSACTIONS_COLLECTION).updateMany(query, update);
}

/**
How many transactions are waiting to be processed into a block?
*/
export async function numberOfUnprocessedTransactions() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db.collection(TRANSACTIONS_COLLECTION).countDocuments({ mempool: true });
}

/**
function to look a transaction by transactionHash, if you know the hash of the transaction.
*/
export async function getTransactionByTransactionHash(transactionHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { transactionHash };
  return db.collection(TRANSACTIONS_COLLECTION).findOne(query);
}

/**
function to find transactions with a transactionHash in the array transactionHashes.
*/
export async function getTransactionsByTransactionHashes(transactionHashes) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { transactionHash: { $in: transactionHashes } };
  const returnedTransactions = await db.collection(TRANSACTIONS_COLLECTION).find(query).toArray();
  // Create a dictionary where we will store the correct position ordering
  const positions = {};
  // Use the ordering of txHashes in the block to fill the dictionary-indexed by txHash
  // eslint-disable-next-line no-return-assign
  transactionHashes.forEach((t, index) => (positions[t] = index));
  const transactions = returnedTransactions.sort(
    (a, b) => positions[a.transactionHash] - positions[b.transactionHash],
  );
  return transactions;
}

export async function deleteTransferAndWithdraw(transactionHashes) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = {
    transactionHash: { $in: transactionHashes },
    transactionType: { $in: [1, 2, 3] },
  };
  return db.collection(TRANSACTIONS_COLLECTION).deleteMany(query);
}

export async function deleteTransactionsFromBlockNumberL1(blockNumber) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { blockNumber: { $gte: Number(blockNumber) } };
  return db.collection(TRANSACTIONS_COLLECTION).deleteMany(query);
}

export async function saveNullifiers(nullifiers, blockNumber) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const indexNullifiers = nullifiers.map(n => {
    return {
      hash: n,
      blockHash: null,
      blockNumber,
    };
  });
  return db.collection(NULLIFIER_COLLECTION).insertMany(indexNullifiers);
}

export async function retrieveNullifiers() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db
    .collection(NULLIFIER_COLLECTION)
    .find({}, { projection: { hash: 1 } })
    .toArray();
}

export async function stampNullifiers(nullifiers, blockHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  // we don't want hashes that already have a blockhash set
  const query = { hash: { $in: nullifiers }, blockHash: { $eq: null } };
  const update = { $set: { blockHash } };
  return db.collection(NULLIFIER_COLLECTION).updateMany(query, update);
}

export async function retrieveMinedNullifiers() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db
    .collection(NULLIFIER_COLLECTION)
    .find({ blockHash: { $ne: null } })
    .toArray();
}

// delete all the nullifiers in this block
export async function deleteNullifiers(blockHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { blockHash };
  return db.collection(NULLIFIER_COLLECTION).deleteMany(query);
}

export async function deleteNullifiersFromBlockNumberL1(blockNumber) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { blockNumber: { $gte: Number(blockNumber) } };
  return db.collection(NULLIFIER_COLLECTION).deleteMany(query);
}

export async function getBlocks() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db
    .collection(SUBMITTED_BLOCKS_COLLECTION)
    .find({}, { sort: { blockNumber: 1 } })
    .toArray();
}

/**
Function to add a set of transactions from the layer 2 mempool once a block has been rolled back
*/
export async function addTransactionsToMemPoolFromBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { blockNumberL2: { $gte: Number(blockNumberL2) } };
  const update = { $set: { mempool: true, blockNumberL2: -1 } };
  return db.collection(TRANSACTIONS_COLLECTION).updateMany(query, update);
}
