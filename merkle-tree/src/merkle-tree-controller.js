/**
This module reacts to external API calls routed via ./routes/merkle-tree.js.
@module merkle-tree-controller.js
@author iAmMichaelConnor
*/

import config from 'config';
import utils from './utils';
import utilsWeb3 from './utils-web3';
import utilsMT from './utils-merkle-tree';

import { LeafService, NodeService, MetadataService } from './db/service';

/**
Check the leaves of the tree are all there.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
@return {integer} maxReliableLeafIndex - the left-most reliable leafIndex (by 'reliable' we mean that there are no missing leaves in the db from 0 to this maxReliableLeafIndex)
*/
async function checkLeaves(db) {
  console.log('\nsrc/merkle-tree-controller checkLeaves()');

  const leafService = new LeafService(db);

  // count all the leaves
  const leafCount = await leafService.countLeaves();
  // get the max leafIndex of all the leaves
  const maxLeafIndex = await leafService.maxLeafIndex();
  let maxReliableLeafIndex;

  // then we can quickly see if there are NOT any missing leaves:
  if (leafCount !== maxLeafIndex + 1) {
    // then we are missing values. Let's do a slower search to find the earliest missing value:
    console.log(
      `\nThere are missing leaves in the db. Found ${leafCount} leaves, but expected ${maxLeafIndex}. Performing a slower check to find the missing leaves...`,
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
TODO: decide whether this is deprecated in favour of the 'cleverer' checkLeaves()
Update the latestLeaf metadata with the leaf object of the highest-indexed leaf which has been stored in the db.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
*/
async function updateLatestLeaf(db) {
  console.log('\nsrc/merkle-tree-controller updateLatestLeaf()');

  const leafService = new LeafService(db);
  const metadataService = new MetadataService(db);

  const maxReliableLeafIndex = await checkLeaves(db);

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
  console.log('\nsrc/merkle-tree-controller updateLatestLeaf()');

  const nodeIndex = utilsMT.leafIndexToNodeIndex(leafIndex);

  // construct an array of indices to query from the db:
  const pathIndices = utilsMT.getPathIndices(nodeIndex);
  console.log(`pathIndices to retreive:`);
  console.log(pathIndices);

  // get the actual nodes from the db:
  const nodeService = new NodeService(db);
  return nodeService.getNodesByNodeIndices(pathIndices);
}

/**
Calculate the siblingPath or 'witness path' for a given leaf.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
@param {integer} leafIndex - the index of the leaf for which we are computing the siblingPath
*/
async function getSiblingPathByLeafIndex(db, leafIndex) {
  console.log('\nsrc/merkle-tree-controller updateLatestLeaf()');

  const nodeIndex = utilsMT.leafIndexToNodeIndex(leafIndex);

  // construct an array of indices to query from the db:
  const siblingPathIndices = utilsMT.getSiblingPathIndices(nodeIndex);
  console.log(`siblingPathIndices to retreive:`);
  console.log(siblingPathIndices);

  // get the actual nodes from the db:
  const nodeService = new NodeService(db);
  return nodeService.getNodesByNodeIndices(siblingPathIndices);
}

/**
Updates the entire tree based on the latest-stored leaves.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
*/
async function update(db) {
  console.log('\nsrc/merkle-tree-controller updateLatestLeaf()');

  const metadataService = new MetadataService(db);

  const { latestLeaf } = await updateLatestLeaf(db); // update the metadata db for future use

  const { latestRecalculation } = (await metadataService.getLatestRecalculation()) || {};

  const fromLeafIndex =
    latestRecalculation === undefined ? 0 : Number(latestRecalculation.leafIndex);
  const toLeafIndex = Number(latestLeaf.leafIndex);
  // const batchSize = toLeafIndex - fromLeafIndex + 1;

  if (fromLeafIndex === toLeafIndex) return true;

  console.log(`\nUpdating the tree from leaf ${fromLeafIndex} to leaf ${toLeafIndex}`);

  const numberOfHashes = utilsMT.getNumberOfHashes(toLeafIndex, fromLeafIndex, config.TREE_HEIGHT);
  console.log(`\n${numberOfHashes} hashes are required to update the tree...`);

  const hashArrayTemplate = utilsMT.getHashArrayTemplate(
    toLeafIndex,
    fromLeafIndex,
    config.TREE_HEIGHT,
  );
  console.log(`\nhashArrayTemplate:`, hashArrayTemplate);

  const { frontier } = latestRecalculation || [];

  return true;
}

/**
Updates the tree (but not necessarily using the latest-stored leafIndex) based on the leaves up to a given leafIndex.
@param {object} db - an instance of mongoose.createConnection (a 'Connection' instance in mongoose terminoligy). This contains permissions to access the merkle tree's databases.
@param {integer} leafIndex - the index of the leaf for which we are computing the siblingPath
*/
async function updateByLeafIndex(db, leafIndex) {
  const nodeIndex = utilsMT.leafIndexToNodeIndex(leafIndex);

  // construct an array of indices to query from the db:
  const siblingPathIndices = utilsMT.getSiblingPathIndices(nodeIndex);
  console.log(`siblingPathIndices to retreive:`);
  console.log(siblingPathIndices);

  // get the actual nodes from the db:
  const nodeService = new NodeService(db);
  return nodeService.getNodesByNodeIndices(siblingPathIndices);
}

export default {
  checkLeaves,
  updateLatestLeaf,
  getPathByLeafIndex,
  getSiblingPathByLeafIndex,
  update,
  updateByLeafIndex,
};
