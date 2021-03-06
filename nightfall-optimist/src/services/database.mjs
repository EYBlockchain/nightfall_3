/**
Functions for storing blockchain data that the optimist application needs to
remember wholesale because otherwise it would have to be constructed in real-
time from blockchain events.
*/
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import mongo from 'common-files/utils/mongo.mjs';
import Timber from 'common-files/classes/timber.mjs';

const {
  MONGO_URL,
  OPTIMIST_DB,
  TRANSACTIONS_COLLECTION,
  PROPOSER_COLLECTION,
  CHALLENGER_COLLECTION,
  SUBMITTED_BLOCKS_COLLECTION,
  INVALID_BLOCKS_COLLECTION,
  NULLIFIER_COLLECTION,
  COMMIT_COLLECTION,
  TIMBER_COLLECTION,
  ZERO,
  HASH_TYPE,
  TIMBER_HEIGHT,
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
Function to retrieve a commit, by commitHash, it also returns the 'retrieved'
which will be true if the commitment hash has already been retrieved
*/
export async function getCommit(commitHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { commitHash };
  const commit = await db.collection(COMMIT_COLLECTION).findOne(query);
  if (commit)
    await db.collection(COMMIT_COLLECTION).updateOne(query, { $set: { retrieved: true } });
  return commit;
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
  logger.debug(`Saving challenger address ${address}`);
  const data = { challenger: address };
  return db.collection(CHALLENGER_COLLECTION).insertOne(data);
}

/**
function to remove addresses that are used to sign challenge transactions. This
is needed in the case of a key compromise, or if we simply no longer wish to use
the address.
*/
export async function removeChallengerAddress(address) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  logger.debug(`Removing challenger address ${address}`);
  const data = { challenger: address };
  return db.collection(CHALLENGER_COLLECTION).deleteOne(data);
}

/**
Function to tell us if an address used to commit to a challenge belongs to us
*/
export async function isChallengerAddressMine(address) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const metadata = await db.collection(CHALLENGER_COLLECTION).findOne({ challenger: address });
  return metadata !== null;
}

/**
function to save a block, so that we can later search the block, for example to
find which block a transaction went into. Note, we'll save all blocks, that get
posted to the blockchain, not just ours.
*/
export async function saveBlock(_block) {
  const block = { _id: _block.blockHash, ..._block };
  if (!block.transactionHashL1)
    throw new Error('Layer 2 blocks must be saved with a valid Layer 1 transactionHash');
  if (!block.blockNumber)
    throw new Error('Layer 2 blocks must be saved with a valid Layer 1 block number');
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  logger.debug(`saving block ${JSON.stringify(block, null, 2)}`);
  // there are three possibilities here:
  // 1) We're just saving a block for the first time.  This is fine
  // 2) We're trying to save a replayed block.  This will correctly fail because the _id will be duplicated
  // 3) We're trying to save a block that we've seen before but it was re-mined due to a chain reorg. In
  //    this case, it's fine, we just update the layer 1 blocknumber and transactionHash to the new values
  const query = { blockHash: block.blockHash };
  const update = { $set: block };
  const existing = await db.collection(SUBMITTED_BLOCKS_COLLECTION).findOne(query);
  if (!existing || !existing.blockNumber) {
    return db.collection(SUBMITTED_BLOCKS_COLLECTION).updateOne(query, update, { upsert: true });
  }
  throw new Error('Attempted to replay existing layer 2 block');
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
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).find(query).toArray();
}

export async function getBlockByTransactionHashL1(transactionHashL1) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { transactionHashL1 };
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
get the latest blockNumberL2 in our database
*/
export async function getLatestBlockInfo() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const [blockInfo] = await db
    .collection(SUBMITTED_BLOCKS_COLLECTION)
    .find({}, { blockNumberL2: 1, blockHash: 1, blockNumber: 1 })
    .sort({ blockNumberL2: -1 })
    .limit(1)
    .toArray();
  return blockInfo ?? { blockNumberL2: -1, blockHash: ZERO };
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
function to find blocks with a layer 2 blockNumber >= blockNumberL2
*/
export async function findBlocksFromBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { blockNumberL2: { $gte: Number(blockNumberL2) } };
  return db
    .collection(SUBMITTED_BLOCKS_COLLECTION)
    .find(query, { sort: { blockNumberL2: 1 } })
    .toArray();
}

/**
function to save an invalid block, so that we can later search the invalid block
and the type of invalid block.
*/
export async function saveInvalidBlock(_block) {
  const block = { _id: _block.blockHash, ..._block };
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  logger.debug(`saving invalid block ${JSON.stringify(block, null, 2)}`);
  const query = { blockHash: block.blockHash };
  const update = { $set: block };
  return db.collection(INVALID_BLOCKS_COLLECTION).updateOne(query, update, { upsert: true });
}

/**
function to store addresses and URL of proposers that are registered through this
app. These are needed because the app needs to know when one of them is the
current (active) proposer, at which point it will automatically start to
assemble blocks on behalf of the proposer. It listens for the NewCurrentProposer
event to determine who is the current proposer.
*/
export async function setRegisteredProposerAddress(address, url) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  logger.debug(`Saving proposer address ${address}`);
  const data = { _id: address };
  const update = { $set: { url } };
  return db.collection(PROPOSER_COLLECTION).updateOne(data, update, { upsert: true });
}

/**
Function to check if the current proposer (as signalled by the NewCurrentProposer blockchain event) is registered through this application, and
thus it should start assembling blocks of transactions.
*/
export async function isRegisteredProposerAddressMine(address) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const metadata = await db.collection(PROPOSER_COLLECTION).findOne({ _id: address });
  logger.silly(`found registered proposer ${JSON.stringify(metadata, null, 2)}`);
  return metadata;
}

/**
  Remove proposer from dB
*/
export async function deleteRegisteredProposerAddress(address) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { _id: address };
  const foundProposer = !!(await db.collection(PROPOSER_COLLECTION).findOne(query));
  if (foundProposer) {
    await db.collection(PROPOSER_COLLECTION).deleteOne(query);
  }
  logger.silly(`deleted registered proposer`);
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
  const { mempool = true, blockNumberL2 = -1 } = _transaction;
  const transaction = {
    _id: _transaction.transactionHash,
    ..._transaction,
    mempool,
    blockNumberL2,
  };
  logger.debug(
    `saving transaction ${transaction.transactionHash}, with layer 1 block number ${_transaction.blockNumber}`,
  );
  // there are three possibilities here:
  // 1) We're just saving a transaction for the first time.  This is fine
  // 2) We're trying to save a replayed transaction.  This will correctly fail because the _id will be duplicated
  // 3) We're trying to save a transaction that we've seen before but it was re-mined due to a chain reorg. In
  //    this case, it's fine, we just update the layer 1 blocknumber and transactionHash to the new values
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { transactionHash: transaction.transactionHash };
  const update = { $set: transaction };
  const existing = await db.collection(TRANSACTIONS_COLLECTION).findOne(query);
  if (!existing)
    return db.collection(TRANSACTIONS_COLLECTION).updateOne(query, update, { upsert: true });
  if (!existing.blockNumber) {
    logger.info('Saving re-mined transaction resulting from chain reorganisation');
    return db.collection(TRANSACTIONS_COLLECTION).updateOne(query, update, { upsert: true });
  }
  throw new Error('Attempted to replay existing transaction');
}

/**
Function to add a set of transactions from the layer 2 mempool once a block has been rolled back
*/
export async function addTransactionsToMemPool(block) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = {
    transactionHash: { $in: block.transactionHashes },
    blockNumberL2: { $eq: block.blockNumberL2 },
  };
  const update = { $set: { mempool: true, blockNumberL2: -1 } };
  return db.collection(TRANSACTIONS_COLLECTION).updateMany(query, update);
}

/**
Function to remove a set of transactions from the layer 2 mempool once they've
been processed into a block
*/
export async function removeTransactionsFromMemPool(
  transactionHashes,
  blockNumberL2 = -1,
  timeBlockL2 = null,
) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { transactionHash: { $in: transactionHashes }, blockNumberL2: -1 };
  const update = { $set: { mempool: false, blockNumberL2, timeBlockL2 } };
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

// function that sets the Block's L1 blocknumber to null
// to indicate that it's back in the L1 mempool (and will probably be re-mined
// and given a new L1 transactionHash)
export async function clearBlockNumberL1ForBlock(transactionHashL1) {
  logger.debug(`clearing layer 1 blockNumber for L2 block with L1 hash ${transactionHashL1}`);
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { transactionHashL1 };
  const update = { $set: { blockNumber: null } };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).updateOne(query, update);
}
/*
For added safety we only delete mempool: true, we should never be deleting
transactions from our local db that have been spent.
*/
export async function deleteTransactionsByTransactionHashes(transactionHashes) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  // We should not delete from a spent mempool
  const query = { transactionHash: { $in: transactionHashes }, mempool: true };
  return db.collection(TRANSACTIONS_COLLECTION).deleteMany(query);
}

// function that sets the Transactions's L1 blocknumber to null
// to indicate that it's back in the L1 mempool (and will probably be re-mined
// and given a new L1 transactionHash)
export async function clearBlockNumberL1ForTransaction(transactionHashL1) {
  logger.debug(`clearing layer 1 blockNumber for L2 transaction with L1 hash ${transactionHashL1}`);
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { transactionHashL1 };
  const update = { $set: { blockNumber: null } };
  return db.collection(TRANSACTIONS_COLLECTION).updateOne(query, update);
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
  return db.collection(NULLIFIER_COLLECTION).find({}).toArray();
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

export async function resetNullifiers(blockHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { blockHash };
  const update = { $set: { blockHash: null } };
  return db.collection(NULLIFIER_COLLECTION).updateMany(query, update);
}

// delete nullifiers by nullifier value
export async function deleteNullifiers(hashes) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { hash: { $in: hashes } };
  return db.collection(NULLIFIER_COLLECTION).deleteMany(query);
}

// delete all the nullifiers in this block
export async function deleteNullifiersForBlock(blockHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { blockHash };
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

// This function is useful in resetting transacations that have been marked out of the mempool because
// we have included them in blocks, but those blocks did not end up being mined on-chain.
export async function resetUnsuccessfulBlockProposedTransactions() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { blockNumberL2: -1, mempool: false }; // Transactions out of mempool but not yet on chain
  const update = { $set: { mempool: true, blockNumberL2: -1 } };
  return db.collection(TRANSACTIONS_COLLECTION).updateMany(query, update);
}

export async function getMempoolTransactions() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db.collection(TRANSACTIONS_COLLECTION).find().toArray();
}

/**
Timber functions
*/

export async function saveTree(blockNumber, blockNumberL2, timber) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db.collection(TIMBER_COLLECTION).insertOne({
    _id: timber.blockNumberL2,
    blockNumber,
    blockNumberL2,
    frontier: timber.frontier,
    leafCount: timber.leafCount,
    root: timber.root,
  });
}

export async function getLatestTree() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const timberObjArr = await db
    .collection(TIMBER_COLLECTION)
    .find()
    .sort({ blockNumberL2: -1 })
    .limit(1)
    .toArray();

  const timberObj =
    timberObjArr.length === 1 ? timberObjArr[0] : { root: 0, frontier: [], leafCount: 0 };
  const t = new Timber(
    timberObj.root,
    timberObj.frontier,
    timberObj.leafCount,
    undefined,
    HASH_TYPE,
    TIMBER_HEIGHT,
  );
  return t;
}

export async function getTreeByBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const { root, frontier, leafCount } =
    (await db.collection(TIMBER_COLLECTION).findOne({ blockNumberL2 })) ?? {};
  const t = new Timber(root, frontier, leafCount, undefined, HASH_TYPE, TIMBER_HEIGHT);
  return t;
}

export async function getTreeByRoot(treeRoot) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const { root, frontier, leafCount } = (await db
    .collection(TIMBER_COLLECTION)
    .findOne({ root: treeRoot })) ?? { root: 0, frontier: [], leafCount: 0 };
  const t = new Timber(root, frontier, leafCount, undefined, HASH_TYPE, TIMBER_HEIGHT);
  return t;
}

export async function getTreeByLeafCount(historicalLeafCount) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const { root, frontier, leafCount } =
    (await db.collection(TIMBER_COLLECTION).findOne({ leafCount: historicalLeafCount })) ?? {};
  const t = new Timber(root, frontier, leafCount, undefined, HASH_TYPE, TIMBER_HEIGHT);
  return t;
}

export async function deleteTreeByBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  await db.collection(TIMBER_COLLECTION).updateOne({ blockNumberL2 }, { $set: { rollback: true } });
  await new Promise(resolve => setTimeout(() => resolve(), 1000));
  return db.collection(TIMBER_COLLECTION).deleteMany({ blockNumberL2: { $gte: blockNumberL2 } });
}
