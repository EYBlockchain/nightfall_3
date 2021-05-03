/**
 * @module leaf.routes.js
 * @author iAmMichaelConnor
 * @desc leaf.routes.js gives api endpoints to access the functions of the merkle-tree microservice
 */

import { LeafService, MetadataService } from '../db/service';
import merkleTreeController from '../merkle-tree-controller';
import logger from '../logger';

/**
 * Add a new leaf to the tree's 'nodes' db.
 * req.body {
 *   contractName: '...',
 *   leaf: {
 *     value: '0xabc123..',
 *     nodeIndex: 12345678, // optional - can be calculated by mapper
 *     leafIndex: 1234,
 *     blockNumber: 60000000
 *   }
 * }
 * @param {*} req
 * @param {*} res
 */
async function insertLeaf(req, res, next) {
  logger.debug('src/routes/leaf.routes insertLeaf()');
  logger.silly(`req.body: ${req.body}`);
  try {
    const { leaf } = req.body;
    const metadataService = new MetadataService(req.user.db);
    const leafService = new LeafService(req.user.db);
    const { treeHeight } = await metadataService.getTreeHeight();

    await leafService.insertLeaf(treeHeight, leaf);

    res.data = { message: 'inserted' };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get a leaf from the tree's 'nodes' db.
 * req.params { leafIndex: 1234 }
 * req.body { contractName: '...', leafIndex: 1234 }
 * @param {*} req
 * @param {*} res
 */
async function getLeafByLeafIndex(req, res, next) {
  logger.debug('src/routes/leaf.routes getLeafByLeafIndex()');
  logger.silly(
    `req.params: ${JSON.stringify(req.params, null, 2)}, req.body: ${JSON.stringify(
      req.body,
      null,
      2,
    )}`,
  );
  try {
    const leafIndex = req.params.leafIndex || req.body.leafIndex || req.body.leafIndex;
    const leafService = new LeafService(req.user.db);
    res.data = await leafService.getLeafByLeafIndex(leafIndex);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get a leaf from the tree's 'nodes' db.
 * req.body {
 *   contractName: '...',
 *   value: '0xabc1234'
 * }
 * @param {*} req
 * @param {*} res
 */
async function getLeafByValue(req, res, next) {
  logger.debug('src/routes/leaf.routes getLeafByValue()');
  logger.silly(
    `req.query: ${JSON.stringify(req.query, null, 2)}, req.body: ${JSON.stringify(
      req.body,
      null,
      2,
    )}`,
  );
  try {
    const value = req.body.value || req.query.value;
    const leafService = new LeafService(req.user.db);
    res.data = await leafService.getLeafByValue(value);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get many leaves from the tree's 'nodes' db.
 * req.body { contractName: '...', leafIndices: [index0, index1, ..., indexn] }
 * or
 * req.body { contractName: '...', values: [value0, value1, ..., valuen] }
 * or
 * req.body { contractName: '...', minIndex: 1234, maxIndex: 5678 }
 * @param {*} req
 * @param {*} res
 */
async function getLeaves(req, res, next) {
  logger.debug('src/routes/leaf.routes getLeaves()');
  logger.silly(
    `req.query: ${JSON.stringify(req.query, null, 2)}, req.body: ${JSON.stringify(
      req.body,
      null,
      2,
    )}`,
  );
  try {
    const leafService = new LeafService(req.user.db);
    // some clients call get with data in the body.  That's naughty but we handle it anyway
    const leafIndices = req.body.leafIndices || req.query.leafIndices;
    const values = req.body.values || req.query.values;
    const minIndex = req.body.minIndex || req.query.minIndex;
    const maxIndex = req.body.maxIndex || req.query.maxIndex;

    // not necessarily, not all of these destructurings will be possible
    logger.silly(`leafIndices: ${JSON.stringify(leafIndices, null, 2)}`);
    logger.silly(`values: ${JSON.stringify(values, null, 2)}`);
    logger.silly(`minIndex: ${minIndex}`);
    logger.silly(`maxIndex: ${maxIndex}`);

    if (leafIndices) {
      res.data = await leafService.getLeavesByLeafIndices(leafIndices);
    } else if (values) {
      res.data = await leafService.getLeavesByValues(values);
    } else if (minIndex || maxIndex) {
      res.data = await leafService.getLeavesByLeafIndexRange(minIndex, maxIndex);
    } else {
      res.data = await leafService.getLeaves();
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Add a new array of leaves to the tree's 'nodes' db.
 * req.body {
 *  contractName: '...',
 *  leaves: [leafObject1, leafObject2,...]
 * };
 * where a leafObject is of the form:
 * {
 *  value: '0xabc123..',
 *  nodeIndex: 12345678, // optional - can be calculated by mapper
 *  leafIndex: 1234,
 *  blockNumber: 60000000,
 * }
 * @param {*} req
 * @param {*} res
 */
async function insertLeaves(req, res, next) {
  logger.debug('src/routes/leaf.routes insertLeaves()');
  logger.silly(`req.body: ${JSON.stringify(req.body, null, 2)}`);
  try {
    const metadataService = new MetadataService(req.user.db);
    const leafService = new LeafService(req.user.db);
    const { leaves } = req.body;
    const { treeHeight } = await metadataService.getTreeHeight();

    await leafService.insertLeaves(treeHeight, leaves);

    res.data = { message: 'inserted' };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Check the leaves of the tree are all there.
 * req.user.db (an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy)) is required, to access the user's db from within the merkleTreeController
 * @param {*} req
 * @param {*} res - { message: true }
 */
async function checkLeaves(req, res, next) {
  const { db } = req.user;

  try {
    const latestLeafDoc = await merkleTreeController.checkLeaves(db);

    res.data = latestLeafDoc;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Count the leaves in the tree's 'nodes' db.
 * @param {*} req
 * @param {*} res
 */
async function countLeaves(req, res, next) {
  logger.debug('src/routes/leaf.routes countLeaves()');

  try {
    const leafService = new LeafService(req.user.db);
    const leafCount = await leafService.countLeaves();
    res.data = { leafCount };
    next();
  } catch (err) {
    next(err);
  }
}

// initializing routes
export default router => {
  // LEAF ROUTES

  router.route('/leaf').post(insertLeaf);

  router.get('/leaf/index/:leafIndex', getLeafByLeafIndex);

  router.route('/leaf/index').get(getLeafByLeafIndex);
  router.route('/leaf/value').get(getLeafByValue);

  // LEAVES ROUTES

  router
    .route('/leaves')
    .get(getLeaves) // will decide within this function whether we're getting leaves by leafIndices or by a leafIndex range, or all leaves.
    .post(insertLeaves);

  router.route('/leaves/check').get(checkLeaves);
  router.route('/leaves/count').get(countLeaves);
};
