/**
 * Functions for storing blockchain data that the optimist application needs to
 * remember wholesale because otherwise it would have to be constructed in real-
 * time from blockchain events.
 */
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import mongo from '@polygon-nightfall/common-files/utils/mongo.mjs';
import Timber from '@polygon-nightfall/common-files/classes/timber.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';

const { ZERO } = constants;

const {
  MONGO_URL,
  OPTIMIST_DB,
  TRANSACTIONS_COLLECTION,
  PROPOSER_COLLECTION,
  SUBMITTED_BLOCKS_COLLECTION,
  INVALID_BLOCKS_COLLECTION,
  COMMIT_COLLECTION,
  TIMBER_COLLECTION,
  TIMBER_HEIGHT,
  HASH_TYPE,
} = config;

/**
 * Function to save a commit, used in a challenge commit-reveal process
 */
export async function saveCommit(commitHash, txDataToSign) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);

  logger.debug({ msg: 'Saving commit hash', commitHash });

  return db.collection(COMMIT_COLLECTION).insertOne({ commitHash, txDataToSign });
}

/**
 * Function to retrieve a commit, by commitHash, it also returns the 'retrieved'
 * which will be true if the commitment hash has already been retrieved
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
 * Function to save a block, so that we can later search the block, for example to
 * find which block a transaction went into. Note, we'll save all blocks, that get
 * posted to the blockchain, not just ours.
 */
export async function saveBlock(_block) {
  const block = { _id: _block.blockHash, ..._block };
  if (!block.transactionHashL1)
    throw new Error('Layer 2 blocks must be saved with a valid Layer 1 transactionHash');

  if (!block.blockNumber)
    throw new Error('Layer 2 blocks must be saved with a valid Layer 1 block number');

  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);

  logger.debug({ msg: 'Saving block', block });

  /* there are three possibilities here:
   1) We're just saving a block for the first time.  This is fine
   2) We're trying to save a replayed block.  This will correctly fail because the _id will be duplicated
   3) We're trying to save a block that we've seen before but it was re-mined due to a chain reorg. In
      this case, it's fine, we just update the layer 1 blocknumber and transactionHash to the new values
  */
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

// export async function numberOfBlockWithTransactionHash(transactionHash) {
//   const connection = await mongo.connection(MONGO_URL);
//   const db = connection.db(OPTIMIST_DB);
//   const query = { transactionHashes: transactionHash };
//   return db.collection(SUBMITTED_BLOCKS_COLLECTION).countDocuments(query);
// }

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
    .find(query, { sort: { blockNumberL2: -1 } })
    .toArray();
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

export async function getBlocks() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db
    .collection(SUBMITTED_BLOCKS_COLLECTION)
    .find({}, { sort: { blockNumber: 1 } })
    .toArray();
}

/**
 * Function to save an invalid block, so that we can later search the invalid block
 * and the type of invalid block.
 */
export async function saveInvalidBlock(_block) {
  const block = { _id: _block.blockHash, ..._block };
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);

  logger.debug({ msg: 'Saving invalid block', block });

  const query = { blockHash: block.blockHash };
  const update = { $set: block };
  return db.collection(INVALID_BLOCKS_COLLECTION).updateOne(query, update, { upsert: true });
}

/**
 * function to find blocks produced by a proposer
 */
export async function findBlocksByProposer(proposer) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { proposer };
  return db
    .collection(SUBMITTED_BLOCKS_COLLECTION)
    .find(query, { sort: { blockNumberL2: 1 } })
    .toArray();
}

/**
 * Function to store addresses and URL of proposers that are registered through this
 * app. These are needed because the app needs to know when one of them is the
 * current (active) proposer, at which point it will automatically start to
 * assemble blocks on behalf of the proposer. It listens for the NewCurrentProposer
 * event to determine who is the current proposer.
 */
export async function setRegisteredProposerAddress(address, url) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);

  logger.debug({ msg: 'Saving proposer address', address });

  const data = { _id: address };
  const update = { $set: { url } };
  return db.collection(PROPOSER_COLLECTION).updateOne(data, update, { upsert: true });
}

/**
 * Function to check if the current proposer (as signalled by the NewCurrentProposer blockchain event) is registered through this application, and
 * thus it should start assembling blocks of transactions.
 */
export async function isRegisteredProposerAddressMine(address) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const proposer = await db.collection(PROPOSER_COLLECTION).findOne({ _id: address });

  logger.debug({ msg: 'Found registered proposer', proposer });

  return proposer;
}

/**
 * Remove proposer from dB
 */
export async function deleteRegisteredProposerAddress(address) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { _id: address };
  const foundProposer = !!(await db.collection(PROPOSER_COLLECTION).findOne(query));
  if (foundProposer) {
    await db.collection(PROPOSER_COLLECTION).deleteOne(query);

    logger.debug({ msg: 'Deleted registered proposer', address });
  }
}

// get all register proposer
export async function getAllRegisteredProposersCount() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db.collection(PROPOSER_COLLECTION).count();
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
    .find({ mempool: true }, { _id: 0 })
    .sort({ fee: -1 })
    .limit(number)
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

  logger.debug({
    msg: 'Saving transaction with layer 1 block number',
    transactionHash: _transaction.transactionHash,
    blockNumber: _transaction.blockNumber,
  });

  /*
   there are three possibilities here:
   1) We're just saving a transaction for the first time.  This is fine
   2) We're trying to save a replayed transaction.  This will correctly fail because the _id will be duplicated
   3) We're trying to save a transaction that we've seen before but it was re-mined due to a chain reorg. In
      this case, it's fine, we just update the layer 1 blocknumber and transactionHash to the new values
  */
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
Function to remove a set of commitments from the layer 2 mempool once they've
been processed into an L2 block
*/
export async function removeCommitmentsFromMemPool(commitments) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { commitments: { $in: commitments } };
  const update = { $set: { mempool: false } };
  return db.collection(TRANSACTIONS_COLLECTION).updateMany(query, update);
}

/**
Function to remove a set of nullifiers from the layer 2 mempool once they've
been processed into an L2 block
*/
export async function removeNullifiersFromMemPool(nullifiers) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { nullifiers: { $in: nullifiers } };
  const update = { $set: { mempool: false } };
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

/**
 * Function that sets the Transactions's L1 blocknumber to null
 * to indicate that it's back in the L1 mempool (and will probably be re-mined
 * and given a new L1 transactionHash)
 */
export async function clearBlockNumberL1ForTransaction(transactionHashL1) {
  logger.debug({
    msg: 'Clearing layer 1 blockNumber for L2 transaction with L1 hash',
    transactionHashL1,
  });

  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = { transactionHashL1 };
  const update = { $set: { blockNumber: null } };
  return db.collection(TRANSACTIONS_COLLECTION).updateOne(query, update);
}

// function to return a transaction that holds a commitment with a specific commitment hash
// and is part of an L2 block
export async function getL2TransactionByCommitment(
  commitmentHash,
  inL2AndNotInL2 = false,
  blockNumberL2OfTx,
) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = inL2AndNotInL2
    ? { commitments: commitmentHash }
    : {
        commitments: commitmentHash,
        blockNumberL2: { $gte: -1, $ne: blockNumberL2OfTx },
      };
  return db.collection(TRANSACTIONS_COLLECTION).findOne(query);
}

// function to return a transaction that holds a commitment with a specific commitment hash
// and is part of an L2 block
export async function getL2TransactionByNullifier(
  nullifierHash,
  inL2AndNotInL2 = false,
  blockNumberL2OfTx,
) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  const query = inL2AndNotInL2
    ? { nullifiers: nullifierHash }
    : {
        nullifiers: nullifierHash,
        blockNumberL2: { $gte: -1, $ne: blockNumberL2OfTx },
      };
  return db.collection(TRANSACTIONS_COLLECTION).findOne(query);
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
  const query = { mempool: true }; // Transactions in the mempool
  return db.collection(TRANSACTIONS_COLLECTION).find(query).toArray();
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

// function to set the path of the transaction hash leaf in transaction hash timber
export async function setTransactionHashSiblingInfo(
  transactionHash,
  transactionHashSiblingPath,
  transactionHashLeafIndex,
  transactionHashesRoot,
) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { transactionHash };
  const update = {
    $set: { transactionHashSiblingPath, transactionHashLeafIndex, transactionHashesRoot },
  };
  const db = connection.db(OPTIMIST_DB);
  return db.collection(TRANSACTIONS_COLLECTION).updateMany(query, update, { upsert: true });
}

// function to get the path of the transaction hash leaf in transaction hash timber
export async function getTransactionHashSiblingInfo(transactionHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(OPTIMIST_DB);
  return db.collection(TRANSACTIONS_COLLECTION).findOne(
    { transactionHash },
    {
      projection: {
        transactionHashSiblingPath: 1,
        transactionHashLeafIndex: 1,
        transactionHashesRoot: 1,
        isOnChain: 1,
      },
    },
  );
}
