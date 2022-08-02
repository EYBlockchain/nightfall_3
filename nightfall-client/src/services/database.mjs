/* ignore unused exports */

/**
Functions for interacting with the local client data stores
// TODO move functionality from commitment-storage.
*/

import config from 'config';
import mongo from 'common-files/utils/mongo.mjs';
import Timber from 'common-files/classes/timber.mjs';
import logger from 'common-files/utils/logger.mjs';
import constants from 'common-files/constants/index.mjs';

const {
  TIMBER_COLLECTION,
  SUBMITTED_BLOCKS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  HASH_TYPE,
} = constants;
const { MONGO_URL, COMMITMENTS_DB, TIMBER_HEIGHT } = config;

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
  // const t = new Timber(timberObj);
  return t;
}

export async function getTreeByRoot(treeRoot) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const { root, frontier, leafCount } = (await db
    .collection(TIMBER_COLLECTION)
    .findOne({ root: treeRoot })) ?? { root: 0, frontier: [], leafCount: 0 };
  const t = new Timber(root, frontier, leafCount, undefined, HASH_TYPE, TIMBER_HEIGHT);
  return t;
}

export async function getTreeByBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const { root, frontier, leafCount } =
    (await db.collection(TIMBER_COLLECTION).findOne({ blockNumberL2 })) ?? {};
  const t = new Timber(root, frontier, leafCount, undefined, HASH_TYPE, TIMBER_HEIGHT);
  return t;
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
  // there are three possibilities here:
  // 1) We're just saving a block for the first time.  This is fine
  // 2) We're trying to save a replayed block.  This will correctly fail because the _id will be duplicated
  // 3) We're trying to save a block that we've seen before but it was re-mined due to a chain reorg. In
  //    this case, it's fine, we just update the layer 1 blocknumber and transactionHash to the new values
  const query = { _id: block._id };
  const update = { $set: block };
  const existing = await db.collection(SUBMITTED_BLOCKS_COLLECTION).findOne(query);
  if (!existing || !existing.blockNumber) {
    return db.collection(SUBMITTED_BLOCKS_COLLECTION).updateOne(query, update, { upsert: true });
  }
  logger.warn('Attempted to replay existing layer 2 block.  This is expected if we are syncing');
  return true;
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
// function that sets the Block's L1 blocknumber to null
// to indicate that it's back in the L1 mempool (and will probably be re-mined
// and given a new L1 transactionHash)
export async function clearBlockNumberL1ForBlock(transactionHashL1) {
  logger.debug(`clearing layer 1 blockNumber for L2 block with L1 hash ${transactionHashL1}`);
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
Function to save a (unprocessed) Transaction
*/
export async function saveTransaction(_transaction) {
  const transaction = {
    _id: _transaction.transactionHash,
    ..._transaction,
  };
  // there are three possibilities here:
  // 1) We're just saving a transaction for the first time.  This is fine
  // 2) We're trying to save a replayed transaction.  This will correctly fail because the _id will be duplicated
  // 3) We're trying to save a transaction that we've seen before but it was re-mined due to a chain reorg. In
  //    this case, it's fine, we just update the layer 1 blocknumber and transactionHash to the new values
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const query = { transactionHash: transaction.transactionHash };
  const update = { $set: transaction };
  const existing = await db.collection(TRANSACTIONS_COLLECTION).findOne(query);
  if (!existing)
    return db.collection(TRANSACTIONS_COLLECTION).updateOne(query, update, { upsert: true });
  if (!existing.blockNumber) {
    return db.collection(TRANSACTIONS_COLLECTION).updateOne(query, update, { upsert: true });
  }
  throw new Error('Attempted to replay existing transaction');
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

export async function getTransactionByCommitment(commitmentHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  // We should not delete from a spent mempool
  const query = { commitments: commitmentHash };
  return db.collection(TRANSACTIONS_COLLECTION).findOne(query);
}

export async function getTransactionByNullifier(nullifierHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  // We should not delete from a spent mempool
  const query = { nullifiers: nullifierHash };
  return db.collection(TRANSACTIONS_COLLECTION).findOne(query);
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
