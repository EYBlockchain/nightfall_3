/* ignore unused exports */

/**
Functions for interacting with the local client data stores
// TODO move functionality from commitment-storage.
*/

import config from 'config';
import mongo from 'common-files/utils/mongo.mjs';
import Timber from 'common-files/classes/timber.mjs';

const { MONGO_URL, COMMITMENTS_DB, TIMBER_COLLECTION } = config;

/**
Timber functions
*/

export async function saveTree(blockNumber, blockNumberL2, timber) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(TIMBER_COLLECTION).insertOne({
    _id: blockNumber,
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
    .sort({ _id: -1 })
    .limit(1)
    .toArray();

  const timberObj =
    timberObjArr.length === 1 ? timberObjArr[0] : { root: 0, frontier: [], leafCount: 0 };
  const t = new Timber(timberObj.root, timberObj.frontier, timberObj.leafCount);
  return t;
}

export async function getTreeByRoot(treeRoot) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const { root, frontier, leafCount } = (await db
    .collection(TIMBER_COLLECTION)
    .findOne({ root: treeRoot })) ?? { root: 0, frontier: [], leafCount: 0 };
  const t = new Timber(root, frontier, leafCount);
  return t;
}

export async function getTreeByLeafCount(historicalLeafCount) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const { root, frontier, leafCount } =
    (await db.collection(TIMBER_COLLECTION).findOne({ leafCount: historicalLeafCount })) ?? {};
  const t = new Timber(root, frontier, leafCount);
  return t;
}

export async function deleteTreeByBlockNumberL2(blockNumberL2) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(TIMBER_COLLECTION).deleteMany({ blockNumberL2: { $gte: blockNumberL2 } });
}
