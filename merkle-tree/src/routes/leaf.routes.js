/**
 * @module leaf.routes.js
 * @author iAmMichaelConnor
 * @desc leaf.routes.js gives api endpoints to access the functions of the merkle-tree microservice
 */

import { LeafService, MetadataService } from '../db/service';
import merkleTreeController from '../merkle-tree-controller';

/**
 * Add a new leaf to the tree's 'nodes' db.
 * req.body {
 *  value: '0xabc123..',
 *  nodeIndex: 12345678,
 *  leafIndex: 1234,
 *  blockNumber: 60000000,
 * }
 * @param {*} req
 * @param {*} res
 */
async function insertLeaf(req, res, next) {
  console.log('\nsrc/routes/leaf.routes insertLeaf()');
  console.log('req.body:');
  console.log(req.body);
  try {
    const metadataService = new MetadataService(req.user.db);
    const { treeHeight } = await metadataService.getTreeHeight();
    req.body.treeHeight = treeHeight;
    const leafService = new LeafService(req.user.db);
    await leafService.insertLeaf(req.body);
    res.data = { message: 'inserted' };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get a leaf from the tree's 'nodes' db.
 * req.params { leafIndex: 1234 }
 * req.body { leafIndex: 1234 }
 * @param {*} req
 * @param {*} res
 */
async function getLeafByLeafIndex(req, res, next) {
  console.log('\nsrc/routes/leaf.routes getLeafByLeafIndex()');
  console.log('req.params:');
  console.log(req.params);
  console.log('req.body:');
  console.log(req.body);
  try {
    const leafIndex = req.params.leafIndex || req.body.leafIndex;
    const leafService = new LeafService(req.user.db);
    res.data = await leafService.getLeafByLeafIndex(leafIndex);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get a leaf from the tree's 'nodes' db.
 * req.body { value: '0xabc1234' }
 * @param {*} req
 * @param {*} res
 */
async function getLeafByValue(req, res, next) {
  console.log('\nsrc/routes/leaf.routes getLeafByValue()');
  console.log('req.body:');
  console.log(req.body);
  try {
    const { value } = req.body;
    const leafService = new LeafService(req.user.db);
    res.data = await leafService.getLeafByValue(value);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get many leaves from the tree's 'nodes' db.
 * req.body { leafIndices: [index0, index1, ..., indexn] }
 * or
 * req.body { values: [value0, value1, ..., valuen] }
 * or
 * req.body { minIndex: 1234, maxIndex: 5678 }
 * @param {*} req
 * @param {*} res
 */
async function getLeaves(req, res, next) {
  console.log('\nsrc/routes/leaf.routes getLeaves()');
  console.log('req.body:');
  console.log(req.body);
  try {
    const leafService = new LeafService(req.user.db);

    const { leafIndices, values, minIndex, maxIndex } = req.body; // necessarily, not all of these deconstructions will be possible
    console.log('leafIndices:', leafIndices);
    console.log('values:', values);
    console.log('minIndex:', minIndex);
    console.log('maxIndex:', maxIndex);

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
 *  leaves: [leafObject1, leafObject2,...]
 * }
 * @param {*} req
 * @param {*} res
 */
async function insertLeaves(req, res, next) {
  console.log('\nsrc/routes/leaf.routes insertLeaves()');
  console.log('req.body:');
  console.log(req.body);
  try {
    const metadataService = new MetadataService(req.user.db);
    const { treeHeight } = await metadataService.getTreeHeight();
    for (let i = 0; i < req.body.length; i += 1) {
      req.body[i].treeHeight = treeHeight;
    }
    const leafService = new LeafService(req.user.db);
    await leafService.insertLeaves(req.body);
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
  console.log('\nsrc/routes/leaf.routes countLeaves()');

  try {
    const leafService = new LeafService(req.user.db);
    const leafCount = await leafService.countLeaves(req.body);
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
