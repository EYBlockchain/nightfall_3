/**
 * @module node.routes.js
 * @author iAmMichaelConnor
 * @desc node.routes.js gives api endpoints to access the functions of the merkle-tree microservice
 */

import { NodeService } from '../db/service';

/**
 * Add a new node to the tree's 'nodes' db.
 * req.body {
 *  value: '0xabc123..',
 *  nodeIndex: 12345678,
 *  isLocked: false,
 * }
 * @param {*} req
 * @param {*} res
 */
async function insertNode(req, res, next) {
  try {
    const nodeService = new NodeService(req.user.db);
    await nodeService.insertNode(req.body);
    res.data = { message: 'inserted' };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get a node from the tree's 'nodes' db.
 * req.params { nodeIndex: 1234 }
 * req.body { nodeIndex: 1234 }
 * @param {*} req
 * @param {*} res
 */
async function getNodeByNodeIndex(req, res, next) {
  try {
    const nodeIndex = req.params.nodeIndex || req.body.nodeIndex;
    const nodeService = new NodeService(req.user.db);
    res.data = await nodeService.getNodeByNodeIndex(nodeIndex);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get a node from the tree's 'nodes' db.
 * req.body { value: '0xabc1234' }
 * @param {*} req
 * @param {*} res
 */
async function getNodeByValue(req, res, next) {
  try {
    const { value } = req.body;
    const nodeService = new NodeService(req.user.db);
    res.data = await nodeService.getNodeByValue(value);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get many nodes from the tree's 'nodes' db.
 * req.body { nodeIndices: [index0, index1, ..., indexn] }
 * or
 * req.body { values: [value0, value1, ..., valuen] }
 * or
 * req.body { minIndex: 1234, maxIndex: 5678 }
 * @param {*} req
 * @param {*} res
 */
async function getNodes(req, res, next) {
  try {
    const nodeService = new NodeService(req.user.db);

    const { nodeIndices, values, minIndex, maxIndex } = req.body; // necessarily, not all of these deconstructions will be possible

    if (nodeIndices) {
      res.data = await nodeService.getNodesByNodeIndices(nodeIndices);
    } else if (values) {
      res.data = await nodeService.getNodesByValues(values);
    } else {
      res.data = await nodeService.getNodesByNodeIndexRange(minIndex, maxIndex);
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Update a node in the db.
 * req.params: { nodeIndex }
 * req.body: {
 *  value: '0xabc123..',
 *  nodeIndex: 12345678,
 *  isLocked: false,
 * }
 * @param {*} req
 * @param {*} res
 */
async function updateNodeByNodeIndex(req, res, next) {
  const nodeIndex = req.params.nodeIndex || req.body.nodeIndex;
  const nodeService = new NodeService(req.user.db);
  try {
    await nodeService.updateNodeByNodeIndex(nodeIndex, req.body);
    res.data = { message: 'updated' };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Update many nodes in the db.
 * req.body [
 *   {
 *     value: '0xabc123..',
 *     nodeIndex: 12345678,
 *     isLocked: false,
 *   },
 *   {
 *     value: '0xabc123..',
 *     nodeIndex: 12345678,
 *     isLocked: false,
 *   }
 * ]
 * @param {*} req
 * @param {*} res
 */
async function updateNodes(req, res, next) {
  const nodeService = new NodeService(req.user.db);
  try {
    await nodeService.updateNodes(req.body);
    res.data = { message: 'updated' };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get the root of the tree from the tree's 'nodes' db.
 * @param {*} req
 * @param {*} res
 */
async function getRoot(req, res, next) {
  try {
    const nodeService = new NodeService(req.user.db);
    res.data = await nodeService.getRoot();
    next();
  } catch (err) {
    next(err);
  }
}

// initializing routes
export default function(router) {
  // NODE ROUTES

  router.route('/node').post(insertNode);

  router
    .route('/node/index/:nodeIndex')
    .get(getNodeByNodeIndex)
    .patch(updateNodeByNodeIndex);

  router
    .route('/node/index')
    .get(getNodeByNodeIndex)
    .patch(updateNodeByNodeIndex);

  router.route('/node/value').get(getNodeByValue);

  // NODES ROUTES

  router
    .route('/nodes')
    .get(getNodes) // will decide within this function whether we're getting nodes by nodeIndices or by a nodeIndex range, or all nodes.
    .patch(updateNodes);

  // ROOT ROUTES

  router.route('/root').get(getRoot);
}
