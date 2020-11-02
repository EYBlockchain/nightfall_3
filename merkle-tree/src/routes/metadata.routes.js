/**
 * @module metadata.routes.js
 * @author iAmMichaelConnor
 * @desc tree.routes.js gives api endpoints to access the functions of the merkle-tree microservice
 */

import { MetadataService } from '../db/service';
import merkleTreeController from '../merkle-tree-controller';

/**
 * Add the relevant contract address to the tree's db.
 * req.body {
 *  contractAddress: '0xabc123..',
 * }
 * @param {*} req
 * @param {*} res
 */
async function insertContractAddress(req, res, next) {
  try {
    const { db } = req.user;
    const metadataService = new MetadataService(db);
    await metadataService.insertContractAddress(req.body);
    res.data = { message: 'inserted' };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Add the relevant contract address to the tree's db.
 * req.body {
 *   contractName: '...',
 *   contractAddress: '0xabc123..',
 * }
 * @param {*} req
 * @param {*} res
 */
async function insertContractInterface(req, res, next) {
  try {
    const { db } = req.user;
    // const contractName = req.body.contractName;
    // const { contractInterface } = req.body;
    // const path = `../../build/contracts/${contractName}.json`;

    const metadataService = new MetadataService(db);
    await metadataService.insertContractInterface(req.body);
    res.data = { message: 'inserted' };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Add the relevant height to the tree's db.
 * req.body {
 *   contractName: '...',
 *   treeHeight: 32,
 * }
 * @param {*} req
 * @param {*} res
 */
async function insertTreeHeight(req, res, next) {
  try {
    const { db } = req.user;
    const metadataService = new MetadataService(db);
    await metadataService.insertTreeHeight(req.body);
    res.data = { message: 'inserted' };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Update the latestLeaf metadata in the tree's db.
 * req.body {
 *   contractName: '...',
 *   latestLeaf: {} // a latestLeaf object
 * }
 * @param {*} req
 * @param {*} res
 */
async function updateLatestLeaf(req, res, next) {
  try {
    const { db } = req.user;
    await merkleTreeController.updateLatestLeaf(db);
    res.data = { message: 'updated' };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Update the latestRecalculation metadata in the tree's db.
 * req.body {
 *   contractName: '...',
 *   latestRecalculation: {} // a latestRecalculation object
 * }
 * @param {*} req
 * @param {*} res
 */
async function updateLatestRecalculation(req, res, next) {
  const { db } = req.user;
  const metadataService = new MetadataService(db);
  try {
    await metadataService.updateLatestRecalculation(req.body);
    res.data = { message: 'updated' };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get all tree metadata from the tree's 'metadata' db.
 * @param {*} req
 * @param {*} res
 */
async function getMetadata(req, res, next) {
  try {
    const { db } = req.user;
    const metadataService = new MetadataService(db);
    res.data = await metadataService.getMetadata();
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get the contract address from the tree's 'metadata' db.
 * @param {*} req
 * @param {*} res
 */
async function getContractAddress(req, res, next) {
  try {
    const { db } = req.user;
    const metadataService = new MetadataService(db);
    res.data = await metadataService.getContractAddress();
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get the contract interface from the tree's 'metadata' db.
 * @param {*} req
 * @param {*} res
 */
async function getContractInterface(req, res, next) {
  try {
    const { db } = req.user;
    const metadataService = new MetadataService(db);
    res.data = await metadataService.getContractInterface();
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get the tree height from the tree's 'metadata' db.
 * @param {*} req
 * @param {*} res
 */
async function getTreeHeight(req, res, next) {
  try {
    const { db } = req.user;
    const metadataService = new MetadataService(db);
    res.data = await metadataService.getTreeHeight();
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get the latestRecalculation tree metadata from the tree's 'metadata' db.
 * @param {*} req
 * @param {*} res
 */
async function getLatestRecalculation(req, res, next) {
  try {
    const { db } = req.user;
    const metadataService = new MetadataService(db);
    res.data = await metadataService.getLatestRecalculation();
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get the latestLeaf tree metadata from the tree's 'tree' db.
 * @param {*} req
 * @param {*} res
 */
async function getLatestLeaf(req, res, next) {
  try {
    const { db } = req.user;
    res.data = await merkleTreeController.updateLatestLeaf(db);
    next();
  } catch (err) {
    next(err);
  }
}

// initializing routes
export default function(router) {
  // NODE ROUTES

  router.route('/metadata').get(getMetadata);

  router
    .route('/metadata/contractAddress')
    .get(getContractAddress)
    .post(insertContractAddress);

  router
    .route('/metadata/contractInterface')
    .get(getContractInterface)
    .post(insertContractInterface);

  router
    .route('/metadata/treeHeight')
    .get(getTreeHeight)
    .post(insertTreeHeight);

  router
    .route('/metadata/latestLeaf')
    .get(getLatestLeaf)
    .patch(updateLatestLeaf);

  router
    .route('/metadata/latestRecalculation')
    .get(getLatestRecalculation)
    .patch(updateLatestRecalculation);
}
