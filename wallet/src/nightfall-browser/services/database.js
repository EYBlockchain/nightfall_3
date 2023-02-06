/* ignore unused exports */

/**
Functions for interacting with the local client data stores
// TODO move functionality from commitment-storage.
*/
import { openDB } from 'idb';
import Timber from '../../common-files/classes/timber';

const {
  COMMITMENTS_DB,
  TIMBER_COLLECTION,
  SUBMITTED_BLOCKS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  COMMITMENTS_COLLECTION,
  KEYS_COLLECTION,
  CIRCUIT_COLLECTION,
  CIRCUIT_HASH_COLLECTION,
  TIMBER_HEIGHT,
  HASH_TYPE,
} = global.config;

// This needs to have better indexDB performance.

const connectDB = async () => {
  return openDB(COMMITMENTS_DB, 1, {
    upgrade(newDb) {
      newDb.createObjectStore(COMMITMENTS_COLLECTION);
      newDb.createObjectStore(TIMBER_COLLECTION);
      newDb.createObjectStore(SUBMITTED_BLOCKS_COLLECTION);
      newDb.createObjectStore(TRANSACTIONS_COLLECTION);
      newDb.createObjectStore(KEYS_COLLECTION);
      newDb.createObjectStore(CIRCUIT_COLLECTION);
      newDb.createObjectStore(CIRCUIT_HASH_COLLECTION);
    },
  });
};

/*
 * function stores circuit data and hash
 */
export async function storeCircuit(key, data, dataHash) {
  const db = await connectDB();
  db.put(
    CIRCUIT_HASH_COLLECTION,
    {
      _id: key,
      dataHash,
    },
    key,
  );
  return db.put(
    CIRCUIT_COLLECTION,
    {
      _id: key,
      data,
    },
    key,
  );
}

export async function getStoreCircuitHash(key) {
  const db = await connectDB();
  return db.get(CIRCUIT_HASH_COLLECTION, key);
}

export async function getStoreCircuit(key) {
  const db = await connectDB();
  return db.get(CIRCUIT_COLLECTION, key);
}

/*
 * function to empty object store contents
 */
export async function emptyStoreBlocks() {
  const db = await connectDB();
  return db.clear(SUBMITTED_BLOCKS_COLLECTION);
}

export async function emptyStoreTimber() {
  const db = await connectDB();
  return db.clear(TIMBER_COLLECTION);
}

/*
 * function checks indexedDb for all files(stored as Uint8Aray)
 * for a particular circuit
 * return array of arrays if all files found, else return false
 */
export async function checkIndexDBForCircuit(circuit) {
  const record = await Promise.all([
    getStoreCircuit(`${circuit}-wasm`),
    getStoreCircuit(`${circuit}-zkey`),
  ]);
  return record.every(r => typeof r !== 'undefined');
}

/*
 * function checks indexedDb for all files hashes
 * for a particular circuit match the S3 manifest
 */
export async function checkIndexDBForCircuitHash(circuitInfo) {
  const circuitName = circuitInfo.name;
  const record = await Promise.all([
    getStoreCircuitHash(`${circuitName}-wasm`),
    getStoreCircuitHash(`${circuitName}-zkey`),
  ]);
  if (record.every(r => typeof r !== 'undefined')) {
    return record.every(r => r.dataHash === circuitInfo.wasmh || r.dataHash === circuitInfo.zkh);
  }
  return false;
}

/**
Timber functions
*/

export async function saveTree(blockNumber, blockNumberL2, timber) {
  const db = await connectDB();
  return db.put(
    TIMBER_COLLECTION,
    {
      _id: blockNumber,
      blockNumberL2,
      frontier: timber.frontier,
      leafCount: timber.leafCount,
      root: timber.root,
    },
    blockNumberL2,
  );
}

export async function getLatestTree() {
  const db = await connectDB();
  const keys = await db.getAllKeys(TIMBER_COLLECTION);
  const maxKey = Math.max(...keys);
  const timberObjArr = await db.get(TIMBER_COLLECTION, maxKey);

  const timberObj = timberObjArr || {
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
  const db = await connectDB();
  if (blockNumberL2 < 0) return new Timber(0, [], 0, undefined, HASH_TYPE, TIMBER_HEIGHT);
  try {
    const { root, frontier, leafCount } = await db.get(TIMBER_COLLECTION, blockNumberL2);
    const t = new Timber(root, frontier, leafCount, undefined, HASH_TYPE, TIMBER_HEIGHT);
    return t;
  } catch (error) {
    throw Error('Tree not Found');
    // TODO Should handle this throw
  }
}

export async function deleteTreeByBlockNumberL2(blockNumberL2) {
  const db = await connectDB();
  return db.delete(TIMBER_COLLECTION, blockNumberL2);
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

  // update value or create a new one
  return db.put(SUBMITTED_BLOCKS_COLLECTION, block, block._id);
}

/**
function to get a block by blockNumberL2, if you know the number of the block. This is useful for rolling back Timber.
*/
export async function getBlockByBlockNumberL2(blockNumberL2) {
  const db = await connectDB();
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
}

/**
function to find blocks with a layer 2 blockNumber >= blockNumberL2
*/
export async function findBlocksFromBlockNumberL2(blockNumberL2) {
  const db = await connectDB();
  const res = await db.getAll(SUBMITTED_BLOCKS_COLLECTION);
  return res.filter(r => r.blockNumberL2 >= blockNumberL2);
}

export async function getBlockByTransactionHash(transactionHash) {
  const db = await connectDB();
  const res = await db.getAll(SUBMITTED_BLOCKS_COLLECTION);
  const [block] = res.filter(r => r.transactionHashes.includes(transactionHash));
  if (!block) throw new Error('Block Not Found');
  return block;
}

export async function getMaxBlock() {
  const db = await connectDB();
  const timbers = await db.getAll(TIMBER_COLLECTION);
  if (timbers.length === 0) return -1;
  const keys = timbers.map(t => t.blockNumberL2);
  const maxKey = Math.max(...keys);
  return maxKey;
}

export async function getNthBlockRoot(index) {
  const db = await connectDB();
  const timbers = await db.getAll(TIMBER_COLLECTION);
  if (!timbers.length || index === null) return null;
  return timbers.find(t => t.blockNumberL2 === index).root;
}

/**
Transaction Collection
*/

export async function updateTransactionTime(transactionHashes, blockTimestamp) {
  const db = await connectDB();
  const keys = await db.getAllKeys(TRANSACTIONS_COLLECTION);
  const txToUpdate = transactionHashes.filter(tx => keys.includes(tx));

  return Promise.all(
    txToUpdate.map(async txHash => {
      const tx = await db.get(TRANSACTIONS_COLLECTION, txHash);
      if (blockTimestamp)
        return db.put(TRANSACTIONS_COLLECTION, { ...tx, createdTime: blockTimestamp }, txHash);
      return db.put(TRANSACTIONS_COLLECTION, tx, txHash);
    }),
  );
}

/**
Function to save a (unprocessed) Transaction
*/
export async function saveTransaction(_transaction) {
  const transaction = {
    _id: _transaction.transactionHash,
    ..._transaction,
  };
  const db = await connectDB();
  transaction.createdTime = _transaction?.createdTime ?? Math.floor(Date.now() / 1000);

  // update or create new transaction record
  return db.put(TRANSACTIONS_COLLECTION, transaction, transaction._id);
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
}

export async function getTransactionByTransactionHash(transactionHash) {
  const db = await connectDB();
  return db.get(TRANSACTIONS_COLLECTION, transactionHash);
}

export async function getAllTransactions() {
  const db = await connectDB();
  const res = await db.getAll(TRANSACTIONS_COLLECTION);
  if (Object.keys(res).length > 0) return res;
  return [];
}

export async function markWithdrawState(transactionHash, withdrawState) {
  const db = await connectDB();
  const tx = await db.get(TRANSACTIONS_COLLECTION, transactionHash);
  return db.put(
    TRANSACTIONS_COLLECTION,
    {
      ...tx,
      withdrawState,
    },
    tx._id,
  );
}

// function to set the path of the transaction hash leaf in transaction hash timber
export async function setTransactionHashSiblingInfo(
  transactionHash,
  transactionHashSiblingPath,
  transactionHashLeafIndex,
  transactionHashesRoot,
) {
  const db = await connectDB();
  const res = await db.getAll(TRANSACTIONS_COLLECTION);
  const filtered = res.filter(r => r._id === transactionHash);
  if (filtered.length === 1) {
    const {
      // transactionHashSiblingPath: a,
      // transactionHashLeafIndex: b,
      // transactionHashesRoot: c,
      ...rest
    } = filtered[0];
    return db.put(
      TRANSACTIONS_COLLECTION,
      {
        transactionHashSiblingPath,
        transactionHashLeafIndex,
        transactionHashesRoot,
        ...rest,
      },
      filtered[0]._id,
    );
  }
  return null;
}

/**
function to find transactions with a transactionHash in the array transactionHashes.
*/
export async function getTransactionsByTransactionHashesByL2Block(transactionHashes, block) {
  const db = await connectDB();
  const res = await db.getAll(TRANSACTIONS_COLLECTION);
  const filteredTransactions = res.filter(
    t => t.blockNumberL2 === block.blockNumberL2 && transactionHashes.includes(t.transactionHash),
  );
  // Create a dictionary where we will store the correct position ordering
  const positions = {};
  // Use the ordering of txHashes in the block to fill the dictionary-indexed by txHash
  // eslint-disable-next-line no-return-assign
  transactionHashes.forEach((t, index) => (positions[t] = index));
  const transactions = filteredTransactions.sort(
    (a, b) => positions[a.transactionHash] - positions[b.transactionHash],
  );
  return transactions;
}
