/* ignore unused exports */

/**
Functions for interacting with the local client data stores
// TODO move functionality from commitment-storage.
*/

import config from 'config';
import { openDB } from 'idb';
import Timber from '../../common-files/classes/timber.mjs';

const { COMMITMENTS_DB, TIMBER_COLLECTION, SUBMITTED_BLOCKS_COLLECTION, TRANSACTIONS_COLLECTION } =
  config;

// This needs to have better indexDB performance.

const connectDB = async () => {
  return openDB(COMMITMENTS_DB, 1, {
    upgrade(newDb) {
      newDb.createObjectStore(TIMBER_COLLECTION);
      newDb.createObjectStore(SUBMITTED_BLOCKS_COLLECTION);
      newDb.createObjectStore(TRANSACTIONS_COLLECTION);
    },
  });
};

/**
Timber functions
*/

export async function saveTree(blockNumber, blockNumberL2, timber) {
  const db = await connectDB();
  return db.put(TIMBER_COLLECTION, blockNumber, {
    _id: blockNumber,
    blockNumberL2,
    frontier: timber.frontier,
    leafCount: timber.leafCount,
    root: timber.root,
  });
  // const connection = await openDB(MONGO_URL);
  // const db = await openDB(COMMITMENTS_DB);
  // return db.collection(TIMBER_COLLECTION).insertOne({
  //   _id: blockNumber,
  //   blockNumberL2,
  //   frontier: timber.frontier,
  //   leafCount: timber.leafCount,
  //   root: timber.root,
  // });
}

export async function getLatestTree() {
  const db = await connectDB();
  const keys = await db.getAllKeys(TIMBER_COLLECTION);
  const maxKey = Math.max(...keys);
  const timberObjArr = await db.get(TIMBER_COLLECTION, maxKey);
  // const timberObjArr = await db
  //   .collection(TIMBER_COLLECTION)
  //   .find()
  //   .sort({ _id: -1 })
  //   .limit(1)
  //   .toArray();

  const timberObj =
    timberObjArr.length === 1 ? timberObjArr[0] : { root: 0, frontier: [], leafCount: 0 };
  const t = new Timber(timberObj.root, timberObj.frontier, timberObj.leafCount);
  return t;
}

export async function getTreeByRoot(treeRoot) {
  const db = await connectDB();
  const vals = await db.getAll(TIMBER_COLLECTION);
  const { root, frontier, leafCount } = vals.filter(v => v.root === treeRoot);
  // const connection = await mongo.connection(MONGO_URL);
  // const db = await openDB(COMMITMENTS_DB);
  // const { root, frontier, leafCount } = (await db
  //   .collection(TIMBER_COLLECTION)
  //   .findOne({ root: treeRoot })) ?? { root: 0, frontier: [], leafCount: 0 };
  const t = new Timber(root, frontier, leafCount);
  return t;
}

export async function getTreeByBlockNumberL2(blockNumberL2) {
  const db = await connectDB();
  const vals = await db.getAll(TIMBER_COLLECTION);
  const { root, frontier, leafCount } = vals.filter(v => v.blockNumberL2 === blockNumberL2);
  // const connection = await mongo.connection(MONGO_URL);
  // const db = await openDB(COMMITMENTS_DB);
  // const { root, frontier, leafCount } =
  //   (await db.collection(TIMBER_COLLECTION).findOne({ blockNumberL2 })) ?? {};
  const t = new Timber(root, frontier, leafCount);
  return t;
}

export async function deleteTreeByBlockNumberL2(blockNumberL2) {
  const db = await connectDB();
  const vals = await db.getAll(TIMBER_COLLECTION);
  const [match] = vals.filter(v => v.blockNumberL2 === blockNumberL2);
  return db.delete(TIMBER_COLLECTION, match);
  // const connection = await mongo.connection(MONGO_URL);
  // const db = await openDB(COMMITMENTS_DB);
  // return db.collection(TIMBER_COLLECTION).deleteMany({ blockNumberL2: { $gte: blockNumberL2 } });
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
  const db = await connectDB();
  const existing = await db.get(SUBMITTED_BLOCKS_COLLECTION, block._id);
  // const connection = await mongo.connection(MONGO_URL);
  // const db = await openDB(COMMITMENTS_DB);
  // there are three possibilities here:
  // 1) We're just saving a block for the first time.  This is fine
  // 2) We're trying to save a replayed block.  This will correctly fail because the _id will be duplicated
  // 3) We're trying to save a block that we've seen before but it was re-mined due to a chain reorg. In
  //    this case, it's fine, we just update the layer 1 blocknumber and transactionHash to the new values
  // const query = { _id: block._id };
  // const update = { $set: block };
  // const existing = await db.collection(SUBMITTED_BLOCKS_COLLECTION).findOne(query);
  if (!existing || !existing.blockNumber) {
    return db.put(SUBMITTED_BLOCKS_COLLECTION, block._id, block);
    // return db.collection(SUBMITTED_BLOCKS_COLLECTION).updateOne(query, update, { upsert: true });
  }
  throw new Error('Attempted to replay existing layer 2 block');
}

/**
function to get a block by blockNumberL2, if you know the number of the block. This is useful for rolling back Timber.
*/
export async function getBlockByBlockNumberL2(blockNumberL2) {
  const db = await connectDB();
  // const query = { blockNumberL2: Number(blockNumberL2) };
  return db.get(SUBMITTED_BLOCKS_COLLECTION, blockNumberL2);
}

/**
function to delete a block. This is useful after a rollback event, whereby the
block no longer exists
*/
export async function deleteBlocksByBlockNumberL2(blockNumberL2) {
  const db = await connectDB();
  const res = await db.getAll(SUBMITTED_BLOCKS_COLLECTION);
  const toDelete = res.filter(r => r.blockNumberL2 >= blockNumberL2);
  return Promise.all(toDelete.map(d => db.delete(SUBMITTED_BLOCKS_COLLECTION, d._id)));
  // const query = { _id: { $gte: blockNumberL2 } };
  // return db.collection(SUBMITTED_BLOCKS_COLLECTION).deleteMany(query);
}

/**
function to find blocks with a layer 2 blockNumber >= blockNumberL2
*/
export async function findBlocksFromBlockNumberL2(blockNumberL2) {
  const db = await connectDB();
  const res = await db.getAll(SUBMITTED_BLOCKS_COLLECTION);
  return res.filter(r => r.blockNumberL2 >= blockNumberL2);
  // const connection = await mongo.connection(MONGO_URL);
  // const db = await openDB(COMMITMENTS_DB);
  // const query = { blockNumberL2: { $gte: Number(blockNumberL2) } };
  // return db
  //   .collection(SUBMITTED_BLOCKS_COLLECTION)
  //   .find(query, { sort: { blockNumberL2: 1 } })
  //   .toArray();
}

export async function getBlockByTransactionHash(transactionHash) {
  const db = await connectDB();
  const res = await db.getAll(SUBMITTED_BLOCKS_COLLECTION);
  return res.filter(r => r.transactionHashes.include(transactionHash));
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
  const db = await connectDB();
  const query = await db.getAll(TRANSACTIONS_COLLECTION);
  // const query = { transactionHash: transaction.transactionHash };
  // const update = { $set: transaction };
  const existing = query.filter(q => q.transactionHash === transaction.transactionHash);
  // const existing = await db.collection(TRANSACTIONS_COLLECTION).findOne(query);
  if (!existing) return db.put(TRANSACTIONS_COLLECTION, transaction._id, transaction);
  if (!existing.blockNumber) {
    return db.put(TRANSACTIONS_COLLECTION, transaction._id, transaction);
  }
  throw new Error('Attempted to replay existing transaction');
}

/*
For added safety we only delete mempool: true, we should never be deleting
transactions from our local db that have been spent.
*/
export async function deleteTransactionsByTransactionHashes(transactionHashes) {
  const db = await connectDB();
  const res = await db.getAll(TRANSACTIONS_COLLECTION);
  const toDelete = transactionHashes.map(t => res.findIndex(r => t === r.transactionHash));
  return Promise.all(toDelete.map(i => db.delete(TRANSACTIONS_COLLECTION, res[i]._id)));
  // const query = { transactionHash: { $in: transactionHashes } };
  // return db.collection(TRANSACTIONS_COLLECTION).deleteMany(query);
}

export async function getTransactionByCommitment(commitmentHash) {
  const db = await connectDB();
  const res = await db.getAll(TRANSACTIONS_COLLECTION);
  return res.filter(r => r.commitments.include(commitmentHash));
  // We should not delete from a spent mempool
  // const query = { commitments: commitmentHash };
  // return db.collection(TRANSACTIONS_COLLECTION).findOne(query);
}

export async function getTransactionByNullifier(nullifierHash) {
  const db = await connectDB();
  const res = await db.getAll(TRANSACTIONS_COLLECTION);
  return res.filter(r => r.nullifiers.include(nullifierHash));
  // const connection = await mongo.connection(MONGO_URL);
  // const db = await openDB(COMMITMENTS_DB);
  // We should not delete from a spent mempool
  // const query = { nullifiers: nullifierHash };
  // return db.collection(TRANSACTIONS_COLLECTION).findOne(query);
}
export async function getTransactionByTransactionHash(transactionHash) {
  const db = await connectDB();
  return db.get(TRANSACTIONS_COLLECTION, transactionHash);
  // return res.filter(r => r.nullifiers.include(nullifierHash));
  // const connection = await mongo.connection(MONGO_URL);
  // const db = await openDB(COMMITMENTS_DB);
  // // We should not delete from a spent mempool
  // const query = { _id: transactionHash };
  // return db.collection(TRANSACTIONS_COLLECTION).findOne(query);
}
