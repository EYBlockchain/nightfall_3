/**
@module utils.js
@author iAmMichaelConnor
@desc Set of utilities for merkle-tree calculations
*/

/* eslint-disable no-bitwise */ // bit operations are essential for merkle-tree computations.

import config from 'config';
import utils from './utils';
import logger from './logger';

function rightShift(integer, shift) {
  return Math.floor(integer / 2 ** shift);
}

function leftShift(integer, shift) {
  return integer * 2 ** shift;
}

// INDEX CONVERSIONS

function leafIndexToNodeIndex(_leafIndex, _height) {
  const leafIndex = Number(_leafIndex);
  const treeWidth = 2 ** _height;
  return leafIndex + treeWidth - 1;
}

function nodeIndexToLeafIndex(_nodeIndex, _height) {
  const nodeIndex = Number(_nodeIndex);
  const treeWidth = 2 ** _height;
  return nodeIndex + 1 - treeWidth;
}

// function nodeIndexToRow(_nodeIndex) {
//   const nodeIndex = Number(_nodeIndex);
//   return Math.floor(Math.log2(nodeIndex + 1));
// }

// function nodeIndexToLevel(_nodeIndex) {
//   const row = nodeIndexToRow(_nodeIndex);
//   return treeHeight - row;
// }

// 'DECIMAL' NODE INDICES

function siblingNodeIndex(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  /*
  odd? then the node is a left-node, so sibling is to the right.
  even? then the node is a right-node, so sibling is to the left.
  */
  return nodeIndex % 2 === 1 ? nodeIndex + 1 : nodeIndex - 1;
}

function parentNodeIndex(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  return nodeIndex % 2 === 1 ? rightShift(nodeIndex, 1) : rightShift(nodeIndex - 1, 1);
}

function leftChildNodeIndex(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  return leftShift(nodeIndex, 1) + 1;
}

function rightChildNodeIndex(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  return leftShift(nodeIndex, 1) + 2;
}

// BINARY INDICES

function siblingBinaryIndex(binaryIndex) {
  /*
  even? then the node is a left-node, so sibling is to the right.
  odd? then the node is a right-node, so sibling is to the left.
  */
  return binaryIndex % 2 === 0 ? binaryIndex + 1 : binaryIndex - 1;
}

function parentBinaryIndex(binaryIndex) {
  // the root has no binary index; it's a special case
  if (binaryIndex === 0 || binaryIndex === 1) return 'root';

  return rightShift(binaryIndex, 1);
}

function leftChildBinaryIndex(binaryIndex) {
  // the root is a special case with no binary index; it's input as a string 'root'
  if (binaryIndex === 'root') return 0;

  return leftShift(binaryIndex, 1);
}

function rightChildBinaryIndex(binaryIndex) {
  // the root is a special case with no binary index; it's input as a string 'root'
  if (binaryIndex === 'root') return 1;

  return leftShift(binaryIndex, 1) + 1;
}

// COMPLEX TREE FUNCTIONS

/**
Recursively calculate the indices of the path from a particular leaf up to the root.
@param {integer} nodeIndex - the nodeIndex of the leaf for which we wish to calculate the siblingPathIndices. Not to be confused with leafIndex.
*/
function getPathIndices(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  if (nodeIndex === 0) return [0]; // terminal case

  const indices = getPathIndices(parentNodeIndex(nodeIndex));

  // push this node to the final output array, as we escape from the recursion:
  indices.push(nodeIndex);
  return indices;
}

/**
Recursively calculate the indices of the sibling path of a particular leaf up to the root.
@param {integer} nodeIndex - the nodeIndex of the leaf for which we wish to calculate the siblingPathIndices. Not to be confused with leafIndex.
*/
function getSiblingPathIndices(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  if (nodeIndex === 0) return [0]; // terminal case

  const indices = getSiblingPathIndices(parentNodeIndex(nodeIndex));

  // push the sibling of this node to the final output array, as we escape from the recursion:
  indices.push(siblingNodeIndex(nodeIndex));
  return indices;
}

/**
A js implementation of the corresponding Solidity function in MerkleTree.sol
*/
function getFrontierSlot(leafIndex) {
  let slot = 0;
  if (leafIndex % 2 === 1) {
    let exp1 = 1;
    let pow1 = 2;
    let pow2 = pow1 << 1;
    while (slot === 0) {
      if ((leafIndex + 1 - pow1) % pow2 === 0) {
        slot = exp1;
      } else {
        pow1 = pow2;
        pow2 <<= 1;
        exp1 += 1;
      }
    }
  }
  return slot;
}

/**
A js implementation of the corresponding Solidity function in MerkleTree.sol
*/
async function updateNodes(leafValues, currentLeafCount, frontier, height, updateNodesFunction) {
  logger.debug(`\nsrc/utils-merkle-tree updateNodes()`);
  const treeWidth = 2 ** height;
  const newFrontier = frontier;

  // check that space exists in the tree:
  const numberOfLeavesAvailable = treeWidth - currentLeafCount;
  const numberOfLeaves = Math.min(leafValues.length, numberOfLeavesAvailable);

  let slot;
  let nodeIndex;
  let nodeValueFull; // the node value before truncation (truncation is sometimes done so that the nodeValue (when concatenated with another) fits into a single hashing round in the next hashing iteration up the tree).
  let nodeValue; // the truncated nodeValue

  // consider each new leaf in turn, from left to right:
  for (
    let leafIndex = currentLeafCount;
    leafIndex < currentLeafCount + numberOfLeaves;
    leafIndex++
  ) {
    nodeValueFull = leafValues[leafIndex - currentLeafCount];
    logger.silly(`nodeValueFull: ${nodeValueFull}, hashlength: ${config.NODE_HASHLENGTH}`);
    if (!utils.isHex(nodeValueFull)) {
      nodeValueFull = utils.convertBase(nodeValueFull.toString(), 10, 16);
      logger.silly(`nodeValueFull: ${nodeValueFull}, hashlength: ${config.NODE_HASHLENGTH}`);
    }
    nodeValue = `0x${nodeValueFull.slice(-config.NODE_HASHLENGTH * 2)}`; // truncate hashed value, so it 'fits' into the next hash.
    logger.silly(`nodeValue: ${nodeValue})`);
    nodeIndex = leafIndexToNodeIndex(leafIndex, height); // convert the leafIndex to a nodeIndex

    slot = getFrontierSlot(leafIndex); // determine at which level we will next need to store a nodeValue

    if (slot === 0) {
      logger.silly('below slot');
      logger.silly('level 0');
      logger.silly(`slot: ${slot}`);
      newFrontier[slot] = nodeValue; // store in frontier
      logger.silly(`frontier ${JSON.stringify(frontier, null, 2)}`);
      continue; // eslint-disable-line no-continue
    }

    // hash up to the level whose nodeValue we'll store in the frontier slot:
    for (let level = 1; level <= slot; level++) {
      logger.silly('below slot');
      logger.silly(`level ${level}`);
      logger.silly(`slot ${slot}`);
      if (nodeIndex % 2 === 0) {
        // even nodeIndex
        logger.silly(`leafIndex ${leafIndex}`);
        logger.silly(`nodeIndex ${nodeIndex}`);
        logger.silly(`left input ${frontier[level - 1]}`);
        logger.silly(`right input ${nodeValue}`);
        nodeValueFull = utils.concatenateThenHash(frontier[level - 1], nodeValue); // the parentValue, but will become the nodeValue of the next level
        nodeValue = `0x${nodeValueFull.slice(-config.NODE_HASHLENGTH * 2)}`; // truncate hashed value, so it 'fits' into the next hash.
        logger.silly(`output ${nodeValue}`);
      } else {
        // odd nodeIndex
        logger.silly(`leafIndex ${leafIndex}`);
        logger.silly(`nodeIndex ${nodeIndex}`);
        logger.silly(`left input ${nodeValue}`);
        logger.silly(`right input ${config.ZERO}`);
        nodeValueFull = utils.concatenateThenHash(nodeValue, config.ZERO); // the parentValue, but will become the nodeValue of the next level
        nodeValue = `0x${nodeValueFull.slice(-config.NODE_HASHLENGTH * 2)}`; // truncate hashed value, so it 'fits' into the next hash.
        logger.silly(`output ${nodeValue}`);
      }
      nodeIndex = parentNodeIndex(nodeIndex); // move one row up the tree

      // add the node to the db:
      const node = {
        value: nodeValue,
        nodeIndex,
      };
      if (!updateNodesFunction) {
        // e.g. for use NOT with a db
        logger.silly(node);
      } else {
        await updateNodesFunction(node); // eslint-disable-line no-await-in-loop
      }
    }

    newFrontier[slot] = nodeValue; // store in frontier
    logger.silly(`frontier, ${JSON.stringify(frontier, null, 2)}`);
  }

  // So far we've added all leaves, and hashed up to a particular level of the tree. We now need to continue hashing from that level until the root:
  for (let level = slot + 1; level <= height; level++) {
    logger.silly('above slot');
    logger.silly(`level, ${level}`);
    logger.silly(`slot, ${slot}`);
    if (nodeIndex % 2 === 0) {
      // even nodeIndex
      logger.silly(`nodeIndex, ${nodeIndex}`);
      logger.silly(`left input, ${frontier[level - 1]}`);
      logger.silly(`right input, ${nodeValue}`);
      nodeValueFull = utils.concatenateThenHash(frontier[level - 1], nodeValue); // the parentValue, but will become the nodeValue of the next level
      nodeValue = `0x${nodeValueFull.slice(-config.NODE_HASHLENGTH * 2)}`; // truncate hashed value, so it 'fits' into the next hash.
      logger.silly(`output: ${nodeValue}`);
    } else {
      // odd nodeIndex
      logger.silly(`nodeIndex, ${nodeIndex}`);
      logger.silly(`left input, ${nodeValue}`);
      logger.silly(`right input, ${config.ZERO}`);
      nodeValueFull = utils.concatenateThenHash(nodeValue, config.ZERO); // the parentValue, but will become the nodeValue of the next level
      nodeValue = `0x${nodeValueFull.slice(-config.NODE_HASHLENGTH * 2)}`; // truncate hashed value, so it 'fits' into the next hash.
      logger.silly(`output, ${nodeValue}`);
    }
    nodeIndex = parentNodeIndex(nodeIndex); // move one row up the tree
    const node = {
      value: nodeIndex === 0 ? nodeValueFull : nodeValue, // we can add the full 32-byte root (nodeIndex=0) to the db, because it doesn't need to fit into another hash round.
      nodeIndex,
    };
    if (!updateNodesFunction) {
      logger.debug(`node, ${node}`);
    } else {
      // add the node to the db
      await updateNodesFunction(node); // eslint-disable-line no-await-in-loop
    }
  }
  const root = nodeValueFull;
  logger.debug(`root: ${root}`);

  return [root, newFrontier];
}

/**
Calculates the exact number of hashes required to add a consecutive batch of leaves to a tree
@param {integer} maxLeafIndex - the highest leafIndex of the batch
@param {integer} minLeafIndex - the lowest leafIndex of the batch
@param {integer} height - the height of the merkle tree
*/
function getNumberOfHashes(maxLeafIndex, minLeafIndex, height) {
  let hashCount = 0;
  let increment;
  let hi = Number(maxLeafIndex);
  let lo = Number(minLeafIndex);
  const batchSize = hi - lo + 1;
  const binHi = hi.toString(2); // converts to binary
  const bitLength = binHi.length;

  for (let level = 0; level < bitLength; level += 1) {
    increment = hi - lo;
    hashCount += increment;
    hi = rightShift(hi, 1);
    lo = rightShift(lo, 1);
  }
  return hashCount + height - (batchSize - 1);
}

/**
For debugging the correctness of getNumberOfHashes: Loops through a calculation of the numberOfHashes for a given batch size, at every leafIndex of the tree.
@param {integer} batchSize - the number of leaves in the batch
@param {integer} height - the height of the merkle tree
*/
function loopNumberOfHashes(batchSize, height) {
  let lo;
  let hi;
  const width = 2 ** height;
  for (let i = 0; i < width - batchSize + 1; i += 1) {
    lo = i;
    hi = i + batchSize - 1;
    const numberOfHashes = getNumberOfHashes(hi, lo, height);
    logger.silly(`(${hi}, ${lo}) = ${numberOfHashes}`);
  }
  return true;
}

export default {
  leafIndexToNodeIndex,
  nodeIndexToLeafIndex,
  siblingNodeIndex,
  parentNodeIndex,
  leftChildNodeIndex,
  rightChildNodeIndex,
  siblingBinaryIndex,
  parentBinaryIndex,
  leftChildBinaryIndex,
  rightChildBinaryIndex,
  getPathIndices,
  getSiblingPathIndices,
  getFrontierSlot,
  updateNodes,
  getNumberOfHashes,
  loopNumberOfHashes,
};
