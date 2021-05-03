/**
 * @module node.routes.js
 * @author iAmMichaelConnor
 * @desc node.routes.js gives api endpoints to access the functions of the merkle-tree microservice
 */

import { NodeService } from '../db/service';
import logger from '../logger';

/**
 * Add a new node to the tree's 'nodes' db.
 * req.body {
 *   contractName: '...',
 *   node: {
 *     value: '0xabc123..',
 *     nodeIndex: 12345678,
 *   }
 * }
 * @param {*} req
 * @param {*} res
 */
async function insertNode(req, res, next) {
  try {
    const { node } = req.body;
    const nodeService = new NodeService(req.user.db);
    await nodeService.insertNode(node);
    res.data = { message: 'inserted' };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get a node from the tree's 'nodes' db.
 * req.params { nodeIndex: 1234 }
 * req.body { contractName: '...', nodeIndex: 1234 }
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
 * req.body { contractName: '...', value: '0xabc1234' }
 * @param {*} req
 * @param {*} res
 */
async function getNodeByValue(req, res, next) {
  try {
    const value = req.body.value || req.query.value;
    const nodeService = new NodeService(req.user.db);
    res.data = await nodeService.getNodeByValue(value);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get many nodes from the tree's 'nodes' db.
 * req.body {
 *   contractName: '...',
 *   treeId: '...', // optional
 *   nodeIndices: [index0, index1, ..., indexn]
 * }
 * or
 * req.body {
 *   contractName: '...',
 *   treeId: '...', // optional,
 *   values: [value0, value1, ..., valuen]
 * }
 * or
 * req.body {
 *   contractName: '...',
 *   treeId: '...', // optional
 *   minIndex: 1234,
 *   maxIndex: 5678
 * }
 * @param {*} req
 * @param {*} res
 */
async function getNodes(req, res, next) {
  try {
    const nodeService = new NodeService(req.user.db);

    const nodeIndices = req.body.nodeIndices || req.query.nodeIndices;
    const values = req.body.values || req.query.values;
    const minIndex = req.body.minIndex || req.query.minIndex;
    const maxIndex = req.body.maxIndex || req.query.maxIndex;
    // necessarily, not all of these deconstructions will be possible

    if (nodeIndices) {
      res.data = await nodeService.getNodesByNodeIndices(nodeIndices);
    } else if (values) {
      res.data = await nodeService.getNodesByValues(values);
    } else if (minIndex || maxIndex) {
      res.data = await nodeService.getNodesByNodeIndexRange(minIndex, maxIndex);
    } else {
      res.data = await nodeService.getNodes();
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
 *   contractName: '...',
 *   treeId: '...', // optional
 *   node: {
 *     value: '0xabc123..',
 *     nodeIndex: 12345678,
 *   }
 * }
 * @param {*} req
 * @param {*} res
 */
async function updateNodeByNodeIndex(req, res, next) {
  const nodeIndex = req.params.nodeIndex || req.body.node.nodeIndex;
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
 * req.body {
 *   contractName: '...',
 *   treeId: '...', // optional
 *   nodes: {
 *     [
 *       {
 *         value: '0xabc123..',
 *         nodeIndex: 12345678,
 *       },
 *       {
 *         value: '0xabc123..',
 *         nodeIndex: 12345678,
 *       }
 *     ]
 *   }
 * }
 * @param {*} req
 * @param {*} res
 */
async function updateNodes(req, res, next) {
  try {
    const { nodes } = req.body;
    const nodeService = new NodeService(req.user.db);
    await nodeService.updateNodes(nodes);
    res.data = { message: 'updated' };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Count the nodes in the tree's 'nodes' db.
 * @param {*} req
 * @param {*} res
 */
async function countNodes(req, res, next) {
  logger.debug('src/routes/leaf.routes countLeaves()');

  try {
    const nodeService = new NodeService(req.user.db);
    const nodeCount = await nodeService.countNodes();
    res.data = { nodeCount };
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

  router.route('/nodes/count').get(countNodes);

  // ROOT ROUTES

  router.route('/root').get(getRoot);
}
