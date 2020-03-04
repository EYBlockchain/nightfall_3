/**
This module reacts to external API calls routed via ./routes/merkle-tree.js.
@module merkle-tree-controller.js
@author iAmMichaelConnor
*/

import config from 'config';
import utilsWeb3 from './utils-web3';
import utilsMT from './utils-merkle-tree';

import { LeafService, NodeService, MetadataService } from './db/service';

/**
Check the leaves of the tree are all there.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
@return {integer} maxReliableLeafIndex - the left-most reliable leafIndex (by 'reliable' we mean that there are no missing leaves in the db from 0 to this maxReliableLeafIndex). Returns -1 if no leaves exist in the tree yet.
*/
async function checkLeaves(db) {
  console.log('\nsrc/merkle-tree-controller checkLeaves()');

  const leafService = new LeafService(db);

  // count all the leaves
  const leafCount = await leafService.countLeaves();
  // get the max leafIndex of all the leaves
  let maxLeafIndex = await leafService.maxLeafIndex();
  if (maxLeafIndex === undefined) maxLeafIndex = -1;

  let maxReliableLeafIndex;

  // then we can quickly see if there are NOT any missing leaves:
  if (leafCount < maxLeafIndex + 1) {
    // then we are missing values. Let's do a slower search to find the earliest missing value:
    console.log(
      `\nThere are missing leaves in the db. Found ${leafCount} leaves, but expected ${maxLeafIndex +
        1}. Performing a slower check to find the missing leaves...`,
    );
    const missingLeaves = await leafService.findMissingLeaves(0, maxLeafIndex);

    console.log('\nmissing leaves:', missingLeaves);

    const minMissingLeafIndex = missingLeaves[0];
    maxReliableLeafIndex = minMissingLeafIndex - 1;

    // get the prior leaf:
    const latestConsecutiveLeaf = await leafService.getLeafByLeafIndex(maxReliableLeafIndex);

    const fromBlock = latestConsecutiveLeaf.blockNumber;

    const currentBlock = await utilsWeb3.getBlockNumber();

    const lag = currentBlock - fromBlock;

    const lagTolerance = config.tolerances.LAG_BEHIND_CURRENT_BLOCK;

    if (lag <= lagTolerance) {
      console.log(
        `\nIdeally, we would re-filter from block ${fromBlock}, but the filter is only ${lag} blocks behind the current block ${currentBlock}. Since the user's config specifies a 'lag' tolerance of ${lagTolerance} blocks, we will not re-filter.`,
      );

      return maxReliableLeafIndex; // return the latest reliable leaf index  up to which we can update the tree
    }
    console.log(
      `\nWe need to re-filter from block ${fromBlock}, but this feature hasn't been built yet!`,
    );
    // TODO: re-filter the blockchain for events from this fromBlock.
  }

  maxReliableLeafIndex = maxLeafIndex;

  return maxReliableLeafIndex;
}

/**
Update the latestLeaf metadata with the leaf object of the highest-indexed leaf which has been stored in the db.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
*/
async function updateLatestLeaf(db) {
  console.log('\nsrc/merkle-tree-controller updateLatestLeaf()');

  const leafService = new LeafService(db);
  const metadataService = new MetadataService(db);

  const maxReliableLeafIndex = await checkLeaves(db);

  if (maxReliableLeafIndex === -1) return null;

  const maxReliableLeaf = await leafService.getLeafByLeafIndex(maxReliableLeafIndex);

  const { blockNumber, leafIndex } = maxReliableLeaf;

  const latestLeaf = {
    blockNumber,
    leafIndex,
  };

  await metadataService.updateLatestLeaf({ latestLeaf });

  return { latestLeaf };
}

/**
Calculate the path (each parent up the tree) from a given leaf to the root.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
@param {integer} leafIndex - the index of the leaf for which we are computing the path
*/
async function getPathByLeafIndex(db, leafIndex) {
  console.log('\nsrc/merkle-tree-controller getPathByLeafIndex()');

  const nodeIndex = utilsMT.leafIndexToNodeIndex(leafIndex);

  // construct an array of indices to query from the db:
  const pathIndices = utilsMT.getPathIndices(nodeIndex);
  // console.log(`pathIndices to retreive:`);
  // console.log(pathIndices);

  // get the actual nodes from the db:
  const nodeService = new NodeService(db);
  const nodes = await nodeService.getNodesByNodeIndices(pathIndices);

  console.log('\n', nodes);

  // Check whether some nodeIndices don't yet exist in the db. If they don't, we'll presume their values are zero, and add these to the 'nodes' before returning them.
  // eslint-disable-next-line no-shadow
  pathIndices.forEach((nodeIndex, index) => {
    if (nodes[index] === undefined || nodes[index].nodeIndex !== pathIndices[index]) {
      const node = {
        value: config.ZERO,
        nodeIndex,
      };
      // insert the node into the nodes array:
      nodes.splice(index, 0, node);
    }
  });

  return nodes;
}

/**
Calculate the siblingPath or 'witness path' for a given leaf.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
@param {integer} leafIndex - the index of the leaf for which we are computing the siblingPath
*/
async function getSiblingPathByLeafIndex(db, leafIndex) {
  console.log('\nsrc/merkle-tree-controller getSiblingPathByLeafIndex()');

  const nodeIndex = utilsMT.leafIndexToNodeIndex(leafIndex);

  // construct an array of indices to query from the db:
  const siblingPathIndices = utilsMT.getSiblingPathIndices(nodeIndex);
  // console.log(`siblingPathIndices to retreive:`);
  // console.log(siblingPathIndices);

  // get the actual nodes from the db:
  const nodeService = new NodeService(db);
  const nodes = await nodeService.getNodesByNodeIndices(siblingPathIndices);

  // Check whether some nodeIndices don't yet exist in the db. If they don't, we'll presume their values are zero, and add these to the 'nodes' before returning them.
  // eslint-disable-next-line no-shadow
  siblingPathIndices.forEach((nodeIndex, index) => {
    if (nodes[index] === undefined || nodes[index].nodeIndex !== siblingPathIndices[index]) {
      const node = {
        value: config.ZERO,
        nodeIndex,
      };
      // insert the node into the nodes array:
      nodes.splice(index, 0, node);
    }
  });

  return nodes;
}

const nodes = [];
let hashCount = 0;
async function updateNodes(node) {
  // console.log('node', node);
  nodes.push(node);
  hashCount += 1;
  // console.log('hashCount', hashCount);
  // console.log('numberOfHashes', this.numberOfHashes);
  if (nodes.length === config.BULK_WRITE_BUFFER_SIZE) {
    await this.nodeService.updateNodes(nodes);
    nodes.length = 0; // empty the array to start again
  } else if (hashCount === this.numberOfHashes) {
    await this.nodeService.updateNodes(nodes);
    nodes.length = 0; // empty the array to start again
    hashCount = 0; // reset the count
  }
}

/**
Updates the entire tree based on the latest-stored leaves.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
*/
async function update(db) {
  console.log('\nsrc/merkle-tree-controller update()');

  const leafService = new LeafService(db);
  const nodeService = new NodeService(db);
  const metadataService = new MetadataService(db);

  // update the metadata db (based on currently stored leaves):
  let { latestLeaf } = await updateLatestLeaf(db);

  // get the latest recalculation metadata (to know how up-to-date the nodes of our tree actually are):
  let { latestRecalculation } = await metadataService.getLatestRecalculation();
  latestRecalculation = latestRecalculation === undefined ? {} : latestRecalculation;

  const latestRecalculationLeafIndex =
    latestRecalculation.leafIndex === undefined ? 0 : Number(latestRecalculation.leafIndex);

  const fromLeafIndex = latestRecalculationLeafIndex === 0 ? 0 : latestRecalculationLeafIndex + 1;

  const toLeafIndex = Number(latestLeaf.leafIndex);

  // Check whether we're already up-to-date:
  if (latestRecalculationLeafIndex < toLeafIndex || latestRecalculationLeafIndex === 0) {
    // We're not up-to-date:
    console.log('\n\n\n\n\nThe tree needs updating.');
    // Recalculate any nodes along the path from the new leaves to the root:
    console.log(`\nUpdating the tree from leaf ${fromLeafIndex} to leaf ${toLeafIndex}`);

    const numberOfHashes = utilsMT.getNumberOfHashes(
      toLeafIndex,
      fromLeafIndex,
      config.TREE_HEIGHT,
    );
    console.log(`\n${numberOfHashes} hashes are required to update the tree...\n\n\n\n\n`);

    let { frontier } = latestRecalculation;
    frontier = frontier === undefined ? [] : frontier;
    const leaves = await leafService.getLeavesByLeafIndexRange(fromLeafIndex, toLeafIndex);
    const leafValues = leaves.map(leaf => leaf.value);
    const currentLeafCount = fromLeafIndex;

    const [root, newFrontier] = await utilsMT.updateNodes(
      leafValues,
      currentLeafCount,
      frontier,
      updateNodes.bind({ nodeService, numberOfHashes }),
    );

    latestRecalculation = {
      blockNumber: latestLeaf.blockNumber,
      leafIndex: toLeafIndex,
      root,
      frontier: newFrontier,
    };
    await metadataService.updateLatestRecalculation({ latestRecalculation });

    // update the metadata db (based on currently stored leaves):
    ({ latestLeaf } = await updateLatestLeaf(db));
  } else {
    console.log('\n\n\n\n\nThe tree is already up to date.\n\n\n\n\n');
  }

  const metadata = await metadataService.getMetadata();

  return metadata;
}

export default {
  checkLeaves,
  updateLatestLeaf,
  getPathByLeafIndex,
  getSiblingPathByLeafIndex,
  update,
};
