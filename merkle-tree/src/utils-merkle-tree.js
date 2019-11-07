/**
@module utils.js
@author iAmMichaelConnor
@desc Set of utilities for merkle-tree calculations
*/

/* eslint-disable no-bitwise */ // bit operations are essential for merkle-tree computations.

import config from 'config';

import utils from './utils';

// const crypto = require('crypto');
// const { Buffer } = require('safe-buffer');
//
// const leafHashLength = config.LEAF_HASHLENGTH;
// const nodeHashLength = config.NODE_HASHLENGTH;

const treeHeight = config.TREE_HEIGHT;
const treeWidth = 2 ** treeHeight;

function rightShift(integer, shift) {
  return Math.floor(integer / 2 ** shift);
}

function leftShift(integer, shift) {
  return integer * 2 ** shift;
}

// INDEX CONVERSIONS

function leafIndexToNodeIndex(_leafIndex) {
  const leafIndex = Number(_leafIndex);
  const output = leafIndex + treeWidth - 1;
  console.log(`leafIndexToNodeIndex(${leafIndex}) = ${output}`);
  return output;
}

function nodeIndexToLeafIndex(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  return nodeIndex + 1 - treeWidth;
}

function nodeIndexToRow(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  return Math.floor(Math.log2(nodeIndex + 1));
}

function nodeIndexToLevel(_nodeIndex) {
  const row = nodeIndexToRow(_nodeIndex);
  return treeHeight - row;
}

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

const testTreeHeight = 25;
const asyncRowStart = 12;
let hashCounter = 0;

async function getLeafValueByNodeIndex(_nodeIndex) {
  // return `0x${_nodeIndex}`;
  return `0xabc123`;
}

function testMerkleRecursion(_nodeIndex) {
  const row = nodeIndexToRow(_nodeIndex);
  const lcni = leftChildNodeIndex(_nodeIndex);
  const rcni = rightChildNodeIndex(_nodeIndex);
  let leftChildValue;
  let rightChildValue;
  if (row === testTreeHeight - 1) {
    // terminal case
    leftChildValue = getLeafValueByNodeIndex(lcni);
    rightChildValue = getLeafValueByNodeIndex(rcni);
  } else {
    leftChildValue = testMerkleRecursion(lcni);
    rightChildValue = testMerkleRecursion(rcni);
  }
  const value = utils.concatenateThenHash(leftChildValue, rightChildValue);
  // console.log(`in: ${leftChildValue}, ${rightChildValue}; out: ${value}`);
  hashCounter += 1;
  // const value = utils.concatenateItems(leftChildValue, rightChildValue);
  if (row <= 4) console.log(row);
  if (row === 0) console.log(`hashCounter: ${hashCounter}`);
  return value;
}

async function testMerkleRecursionAsync(_nodeIndex) {
  const row = nodeIndexToRow(_nodeIndex);
  const lcni = leftChildNodeIndex(_nodeIndex);
  const rcni = rightChildNodeIndex(_nodeIndex);
  let leftChildValue;
  let rightChildValue;
  if (row === testTreeHeight - 1) {
    // terminal case
    [leftChildValue, rightChildValue] = await Promise.all([
      getLeafValueByNodeIndex(lcni),
      getLeafValueByNodeIndex(rcni),
    ]);
  } else if (row >= asyncRowStart) {
    leftChildValue = testMerkleRecursion(lcni);
    rightChildValue = testMerkleRecursion(rcni);
  } else {
    [leftChildValue, rightChildValue] = await Promise.all([
      testMerkleRecursionAsync(lcni),
      testMerkleRecursionAsync(rcni),
    ]);
  }
  const value = utils.concatenateThenHash(leftChildValue, rightChildValue);
  // console.log(`in: ${leftChildValue}, ${rightChildValue}; out: ${value}`);
  // const value = utils.concatenateItems(leftChildValue, rightChildValue);
  if (row <= 5) console.log(row);
  return value;
}

function testMerkleIteration() {
  hashCounter = 0;
  let width;
  let parentWidth;
  let index;
  let leftChildValue;
  let rightChildValue;

  // row = testTreeHeight (bottom row):
  console.log(testTreeHeight);
  let row = testTreeHeight;
  const hashArray = new Array(row);
  width = 2 ** row;
  parentWidth = width / 2;
  hashArray[row - 1] = new Array(parentWidth);
  index = width - 1;
  console.log(`row: ${row}`);
  for (let j = 0; j < width - 1; j += 2) {
    // if (j % 100000 === 0) console.log(`col: ${j}`);
    leftChildValue = getLeafValueByNodeIndex(index);
    index += 1;
    rightChildValue = getLeafValueByNodeIndex(index);
    index += 1;
    hashArray[row - 1][j / 2] = utils.concatenateThenHash(leftChildValue, rightChildValue);
    // console.log(`hashArray`, hashArray);
    // console.log(`in: ${leftChildValue}, ${rightChildValue}; out: ${hashArray[row - 1][j / 2]}`);
    hashCounter += 1;
  }

  for (row = testTreeHeight - 1; row > 0; row -= 1) {
    width /= 2;
    parentWidth = width / 2;
    hashArray[row - 1] = new Array(parentWidth);
    index = width - 1;
    console.log(`row: ${row}`);
    index = 0;
    for (let j = 0; j < width - 1; j += 2) {
      // if (j % 100000 === 0) console.log(`col: ${j}`);
      // console.log('whats this left:', hashArray[row][index]);
      leftChildValue = hashArray[row][index];
      index += 1;
      // console.log('whats this right:', hashArray[row][index]);
      rightChildValue = hashArray[row][index];
      index += 1;
      hashArray[row - 1][j / 2] = utils.concatenateThenHash(leftChildValue, rightChildValue);
      // console.log(`hashArray`, hashArray);
      // console.log(`in: ${leftChildValue}, ${rightChildValue}; out: ${hashArray[row - 1][j / 2]}`);
      hashCounter += 1;
    }
    // clear used row:
    hashArray[row].length = 0;
  }
  console.log(`hashCounter: ${hashCounter}`);
  return hashArray[0][0];
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
function insertLeaves(leafValues, leafCount, frontier, treeHeight) {
  let newLeafCount = leafCount;
  const newFrontier = frontier;
  const treeWidth = 2 ** treeHeight;

  // check that space exists in the tree:
  const numberOfLeavesAvailable = treeWidth - leafCount;
  const numberOfLeaves = Math.min(leafValues.length, numberOfLeavesAvailable);

  let slot;
  let nodeIndex;
  let nodeValue;

  // consider each new leaf in turn, from left to right:
  for (let leafIndex = leafCount; leafIndex < numberOfLeaves; leafIndex += 1) {
    nodeValue = leafValues[leafIndex - leafCount];

    slot = getFrontierSlot(leafIndex); // determine at which level we will next need to store a nodeValue

    if (slot === 0) {
      newFrontier[slot] = nodeValue; // store in frontier
      continue; // eslint-disable-line no-continue
    }

    nodeIndex = nodeIndexToLeafIndex(leafIndex); // convert the leafIndex to a nodeIndex

    // hash up to the level whose nodeValue we'll store in the frontier slot:
    for (let level = 1; level <= slot; level += 1) {
      if (nodeIndex % 2 === 0) {
        // even nodeIndex
        nodeValue = utils.concatenateThenHash(frontier[level - 1], nodeValue); // the parentValue, but will become the nodeValue of the next level
      } else {
        // odd nodeIndex
        nodeValue = utils.concatenateThenHash(nodeValue, config.ZERO); // the parentValue, but will become the nodeValue of the next level
      }

      nodeIndex = parentNodeIndex(nodeIndex); // move one row up the tree
    }

    newFrontier[slot] = nodeValue; // store in frontier
  }

  // So far we've added all leaves, and hashed up to a particular level of the tree. We now need to continue hashing from that level until the root:
  for (let level = slot + 1; level <= treeHeight; level += 1) {
    if (nodeIndex % 2 === 0) {
      // even nodeIndex
      nodeValue = utils.concatenateThenHash(frontier[level - 1], nodeValue); // the parentValue, but will become the nodeValue of the next level
    } else {
      // odd nodeIndex
      nodeValue = utils.concatenateThenHash(nodeValue, config.ZERO); // the parentValue, but will become the nodeValue of the next level
    }

    nodeIndex = parentNodeIndex(nodeIndex); // move one row up the tree
  }

  const root = nodeValue; // nodeValue is now the root of the tree

  newLeafCount += numberOfLeaves;

  return [newLeafCount, root, newFrontier];
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
Calculates the exact number of hashes required to add a consecutive batch of leaves to a tree
@param {integer} maxLeafIndex - the highest leafIndex of the batch
@param {integer} minLeafIndex - the lowest leafIndex of the batch
@param {integer} height - the height of the merkle tree
*/
function getHashArrayTemplate(maxLeafIndex, minLeafIndex, height) {
  const hashArrayTemplate = [];
  let hi = Number(maxLeafIndex);
  let lo = Number(minLeafIndex);

  for (let level = 0; level < height; level += 1) {
    const diff = hi - lo;
    const binDiff = diff.toString(2); // converts to binary
    const bitLength = binDiff.length;
    hashArrayTemplate[level] = new Array(bitLength).fill(level);
    hi = rightShift(hi, 1);
    lo = rightShift(lo, 1);
  }

  return hashArrayTemplate;
}

/**
For debugging: Loops through a calculation of the numberOfHashes for a given batch size, at every leafIndex of the tree.
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
    console.log(`(${hi}, ${lo}) = ${numberOfHashes}`);
    const hashArrayTemplate = getHashArrayTemplate(hi, lo, height);
    console.log(`hashArrayTemplate:`, hashArrayTemplate);
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
  testMerkleRecursion,
  testMerkleRecursionAsync,
  testMerkleIteration,
  getFrontierSlot,
  insertLeaves,
  getNumberOfHashes,
  getHashArrayTemplate,
  loopNumberOfHashes,
};
