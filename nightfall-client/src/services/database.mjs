/* ignore unused exports */

/**
Functions for interacting with the local client data stores
// TODO move functionality from commitment-storage.
*/

import config from 'config';
import mongo from 'common-files/utils/mongo.mjs';
import Timber from 'common-files/classes/timber.mjs';
import logger from 'common-files/utils/logger.mjs';

const {
  MONGO_URL,
  COMMITMENTS_DB,
  TIMBER_COLLECTION,
  SUBMITTED_BLOCKS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  TIMBER_HEIGHT,
  HASH_TYPE,
} = config;

/**
Timber functions
*/

export async function saveTree(transactionHashL1, blockNumberL2, timber) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(TIMBER_COLLECTION).insertOne({
    _id: transactionHashL1,
    blockNumberL2,
    frontier: timber.frontier,
    leafCount: timber.leafCount,
    root: timber.root,
  });
}

export async function getLatestTree() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const timberObjArr = await db
    .collection(TIMBER_COLLECTION)
    .find()
    .sort({ blockNumberL2: -1 })
    .limit(1)
    .toArray();

  const timberObj =
    timberObjArr.length === 1
      ? timberObjArr[0]
      : {
          root: 0,
          frontier: [],
          leafCount: 0,
          tree: undefined,
          hashType: HASH_TYPE,
          height: TIMBER_HEIGHT,
        };

  const t = new Timber(
    timberObj.root,
    timberObj.frontier,
    timberObj.leafCount,
    timberObj.tree,
    timberObj.hashType,
    timberObj.height,
  );
  return t;
}

export async function getTreeByBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  if (blockNumberL2 < 0) return new Timber(0, [], 0, undefined, HASH_TYPE, TIMBER_HEIGHT);
  try {
    const { root, frontier, leafCount } =
      (await db.collection(TIMBER_COLLECTION).findOne({ blockNumberL2 })) ?? {};
    const t = new Timber(root, frontier, leafCount, undefined, HASH_TYPE, TIMBER_HEIGHT);
    return t;
  } catch (error) {
    throw Error('Tree not Found');
    // TODO Should handle this throw
  }
}

export async function deleteTreeByBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(TIMBER_COLLECTION).deleteMany({ blockNumberL2: { $gte: blockNumberL2 } });
}

export async function deleteTreeByTransactionHashL1(transactionHashL1) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(TIMBER_COLLECTION).deleteOne({ transactionHashL1 });
}

export async function getNumberOfL2Blocks() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(TIMBER_COLLECTION).find().count();
}

/**
Blocks Collection
*/

/**
function to save a block, so that we can later search the block, for example to
find which block a transaction went into. Note, we'll save all blocks, that get
posted to the blockchain, not just ours.
*/
export async function saveBlock(_block) {
  const block = { _id: _block.blockNumberL2, ..._block };
  if (!block.transactionHashL1)
    throw new Error('Layer 2 blocks must be saved with a valid Layer 1 transactionHash');
  if (!block.blockNumber)
    throw new Error('Layer 2 blocks must be saved with a valid Layer 1 block number');
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { _id: block._id };
  const update = { $set: block };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).updateOne(query, update, { upsert: true });
}

/**
function to get a block by blockNumberL2, if you know the number of the block. This is useful for rolling back Timber.
*/
export async function getBlockByBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { blockNumberL2: Number(blockNumberL2) };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).findOne(query);
}

/**
function to delete a block. This is useful after a rollback event, whereby the
block no longer exists
*/
export async function deleteBlocksByBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { _id: { $gte: blockNumberL2 } };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).deleteMany(query);
}

/**
function to find blocks with a layer 2 blockNumber >= blockNumberL2
*/
export async function findBlocksFromBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { blockNumberL2: { $gte: Number(blockNumberL2) } };
  return db
    .collection(SUBMITTED_BLOCKS_COLLECTION)
    .find(query, { sort: { blockNumberL2: 1 } })
    .toArray();
}

export async function getBlockByTransactionHash(transactionHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { transactionHashes: transactionHash };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).findOne(query);
}

export async function getBlockByTransactionHashL1(transactionHashL1) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { transactionHashL1 };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).findOne(query);
}

/**
 * Function that sets the Block's L1 blocknumber to null
 * to indicate that it's back in the L1 mempool (and will probably be re-mined
 * and given a new L1 transactionHash)
 */
export async function clearBlockNumberL1ForBlock(transactionHashL1) {
  logger.debug({
    msg: 'Clearing layer 1 blockNumber for L2 block with L1 hash',
    transactionHashL1,
  });

  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { transactionHashL1 };
  const update = { $set: { blockNumber: null } };
  return db.collection(SUBMITTED_BLOCKS_COLLECTION).updateOne(query, update);
}

/**
Transaction Collection
*/

/**
 * Save an unprocessed transaction
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
    msg: 'Saving transaction',
    transactionHash: _transaction.transactionHash,
    blockNumber: _transaction.blockNumber,
  });
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(TRANSACTIONS_COLLECTION).insertOne(transaction);
}

export async function updateTransaction(transactionHash, updates) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(TRANSACTIONS_COLLECTION).updateOne({ transactionHash }, { $set: updates });
}

/*
To get all transactions in the collection. This can be used
to decrypt commitments when new ivk is received.
*/
export async function getAllTransactions() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(TRANSACTIONS_COLLECTION).find().toArray();
}

/*
For added safety we only delete mempool: true, we should never be deleting
transactions from our local db that have been spent.
*/
export async function deleteTransactionsByTransactionHashes(transactionHashes) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { transactionHash: { $in: transactionHashes } };
  return db.collection(TRANSACTIONS_COLLECTION).deleteMany(query);
}

export async function getTransactionByTransactionHash(transactionHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  // We should not delete from a spent mempool
  const query = { _id: transactionHash };
  return db.collection(TRANSACTIONS_COLLECTION).findOne(query);
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
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(TRANSACTIONS_COLLECTION).updateMany(query, update);
}

// function to get the path of the transaction hash leaf in transaction hash timber
export async function getTransactionHashSiblingInfo(transactionHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
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

/**
function to find transactions with a transactionHash in the array transactionHashes.
*/
export async function getTransactionsByTransactionHashesByL2Block(transactionHashes, block) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = {
    transactionHash: { $in: transactionHashes },
    blockNumberL2: { $eq: block.blockNumberL2 },
  };
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

/**
 * Function to find duplicate transactions for an array of commitments or nullifiers
 * this function is used in blockProposedEventHandler
 */
export async function findDuplicateTransactions(commitments, nullifiers, transactionHashes = []) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = {
    $or: [{ commitments: { $in: commitments } }, { nullifiers: { $in: nullifiers } }],
    transactionHash: { $nin: transactionHashes },
    blockNumberL2: { $exists: false },
  };
  return db.collection(TRANSACTIONS_COLLECTION).find(query).toArray();
}
