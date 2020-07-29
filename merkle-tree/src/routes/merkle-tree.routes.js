/**
 * @module node.routes.js
 * @author iAmMichaelConnor
 * @desc merkle-tree.routes.js gives api endpoints to access the functions of the merkle-tree microservice
 */

import contractController from '../contract-controller';
import filterController from '../filter-controller';
import merkleTreeController from '../merkle-tree-controller';

const alreadyStarted = {}; // initialises as false
const alreadyStarting = {}; // initialises as false

/**
 * Updates the entire tree based on the latest-stored leaves.
 * req.user.db (an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy)) is required, to access the user's db from within the merkleTreeController
 * @param {*} req
 * @param {*} res - returns the tree's metadata
 */
async function startEventFilter(req, res, next) {
  console.log('\nsrc/routes/merkle-tree.routes startEventFilter()');

  const contractName = req.body.contractName;
  const treeId = req.body.treeId;
  const { db } = req.user;
  const { contractAddress } = req.body; // contractAddress is an optional parameter. Address can instead be inferred by Timber in many cases.

  try {
    if (alreadyStarted[contractName] && (treeId === undefined || treeId === '')) {
      res.data = { message: `filter already started for ${contractName}` };
    } else if (alreadyStarted[(contractName, treeId)]) {
      res.data = { message: `filter already started for ${contractName}.${treeId}` };
    } else if (alreadyStarting[contractName] && (treeId === undefined || treeId === '')) {
      res.data = {
        message: `filter is already in the process of being started for ${contractName}`,
      };
    } else if (alreadyStarting[(contractName, treeId)]) {
      res.data = {
        message: `filter is already in the process of being started for ${contractName}.${treeId}`,
      };
    } else {
      if (treeId === undefined || treeId === '') {
        alreadyStarting[contractName] = true;
        console.log(`starting filter for ${contractName}`);
      } else {
        alreadyStarting[(contractName, treeId)] = true;
        console.log(`starting filter for ${contractName}.${treeId}`);
      }
      // get a web3 contractInstance we can work with:
      const contractInstance = await contractController.instantiateContract(
        db,
        contractName,
        contractAddress,
      );

      // start an event filter on this contractInstance:
      const started = await filterController.start(db, contractName, contractInstance, treeId);

      if (treeId === undefined || treeId === '') {
        alreadyStarted[contractName] = started; // true/false
        alreadyStarting[contractName] = false;
      } else {
        alreadyStarted[(contractName, treeId)] = started; // true/false
        alreadyStarting[(contractName, treeId)] = false;
      }
      res.data = { message: 'filter started' };
    }
    next();
  } catch (err) {
    alreadyStarting[contractName] = false;
    next(err);
  }
}

/**
 * Get the siblingPath or 'witness path' for a given leaf.
 * req.user.db (an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy)) is required, to access the user's db from within the merkleTreeController
 * req.params {
 *  leafIndex: 1234,
 * }
 * @param {*} req
 * @param {*} res
 */
async function getSiblingPathByLeafIndex(req, res, next) {
  console.log('\nsrc/routes/merkle-tree.routes getSiblingPathByLeafIndex()');
  console.log('req.params:');
  console.log(req.params);

  const { db } = req.user;
  let { leafIndex } = req.params;
  leafIndex = Number(leafIndex); // force to number

  try {
    // first update all nodes in the DB to be in line with the latest-known leaf:
    await merkleTreeController.update(db);

    // get the sibling path:
    const siblingPath = await merkleTreeController.getSiblingPathByLeafIndex(db, leafIndex);

    res.data = siblingPath;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Get the path for a given leaf.
 * req.user.db (an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy)) is required, to access the user's db from within the merkleTreeController
 * req.params {
 *  leafIndex: 1234,
 * }
 * @param {*} req
 * @param {*} res
 */
async function getPathByLeafIndex(req, res, next) {
  console.log('\nsrc/routes/merkle-tree.routes getPathByLeafIndex()');
  console.log('req.params:');
  console.log(req.params);

  const { db } = req.user;
  let { leafIndex } = req.params;
  leafIndex = Number(leafIndex); // force to number

  try {
    // first update all nodes in the DB to be in line with the latest-known leaf:
    await merkleTreeController.update(db);

    // get the path:
    const path = await merkleTreeController.getPathByLeafIndex(db, leafIndex);

    res.data = path;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Updates the entire tree based on the latest-stored leaves.
 * req.user.db (an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy)) is required, to access the user's db from within the merkleTreeController
 * @param {*} req
 * @param {*} res - returns the tree's metadata
 */
async function update(req, res, next) {
  console.log('\nsrc/routes/merkle-tree.routes update()');

  const { db } = req.user;

  try {
    const metadata = await merkleTreeController.update(db);

    res.data = metadata;
    next();
  } catch (err) {
    next(err);
  }
}

// initializing routes
export default function(router) {
  router.route('/start').post(startEventFilter);

  router.route('/update').patch(update);

  router.get('/siblingPath/:leafIndex', getSiblingPathByLeafIndex);
  router.get('/path/:leafIndex', getPathByLeafIndex);
}
