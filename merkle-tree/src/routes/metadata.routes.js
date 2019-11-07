/**
 * @module tree.routes.js
 * @author iAmMichaelConnor
 * @desc tree.routes.js gives api endpoints to access the functions of the merkle-tree microservice
 */

import { MetadataService } from '../db/service';
import merkleTreeController from '../merkle-tree-controller';

/**
 * Add a new node to the tree's 'nodes' db.
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
 * Update the latestLeaf metadata in the tree's db.
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
 *   latestLeaf: {
 *     blockNumber: 12345678,
 *     leafIndex: 87654321,
 *     root: '0xabc1234',
 *   }
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
 * Get all tree metadata from the tree's 'tree' db.
 * @param {*} req
 * @param {*} res
 */
async function getTreeMetadata(req, res, next) {
  try {
    const { db } = req.user;
    const metadataService = new MetadataService(db);
    res.data = await metadataService.getTreeMetadata();
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get the latestRecalculation tree metadata from the tree's 'tree' db.
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
TODO: I don't think we want to query this directly, as the metadata db doesn't keep-pace with the filter automatically. We might need to call the 'update' function in order to get the latest leaf. DONE!
 * Get the latestLeaf tree metadata from the tree's 'tree' db.
 * @param {*} req
 * @param {*} res
 */
async function getLatestLeaf(req, res, next) {
  try {
    // const metadataService = new MetadataService(req.user.db);
    // res.data = await metadataService.getLatestLeaf();
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

  router.route('/metadata').get(getTreeMetadata);

  router.route('/metadata/contractAddress').post(insertContractAddress);

  router
    .route('/metadata/latestLeaf')
    .get(getLatestLeaf)
    .patch(updateLatestLeaf);

  router
    .route('/metadata/latestRecalculation')
    .get(getLatestRecalculation)
    .patch(updateLatestRecalculation);
}
