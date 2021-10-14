/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

/**
A class for timber-like merkle trees.
*/

import config from 'config';
import utils from '../utils/crypto/merkle-tree/utils.mjs';

const { TIMBER_HEIGHT } = config;
export const TIMBER_WIDTH = 2 ** TIMBER_HEIGHT;

/** 
Helper functions for use in the Timber class, defined here before use
*/

// This helps to create a branch object
const Branch = (leftTree, rightTree) => ({
  tag: 'branch',
  left: leftTree,
  right: rightTree,
});

// This helps to create a leaf object
const Leaf = leafVal => ({
  tag: 'leaf',
  value: leafVal,
});

/**
This function is called recursively to traverse down the tree using the known insertion path
@function _insertLeaf
@param {string} leafVal - The commitment hash to be inserted into the tree
@param {object} tree - The tree where leafVal will be inserted
@param {string} path - The path down tree that leafVal will be inserted into 
@returns {object} An updated tree post-insertion
*/
const _insertLeaf = (leafVal, tree, path) => {
  // The base case is when we have reached the end of the path, we return the the leafVal as a Leaf Object
  if (path.length === 0) return Leaf(leafVal);
  switch (tree.tag) {
    // If we are at a branch, we use the next element in path to decide if we go down the left or right subtree.
    case 'branch':
      return path[0] === '0'
        ? Branch(_insertLeaf(leafVal, tree.left, path.slice(1)), tree.right)
        : Branch(tree.left, _insertLeaf(leafVal, tree.right, path.slice(1)));
    // If we are at a leaf AND path.length > 0, we need to expand the undeveloped subtree
    // We then use the next element in path to decided which subtree to traverse
    case 'leaf':
      return path[0] === '0'
        ? Branch(_insertLeaf(leafVal, Leaf(0), path.slice(1)), Leaf(0))
        : Branch(Leaf(0), _insertLeaf(leafVal, Leaf(0), path.slice(1)));
    default:
      return tree;
  }
};

/**
This function is called recursively to traverse down the tree to find check set membership
@function _checkMembership
@param {string} leafVal - The commitment hash that is being checked
@param {object} tree - The tree that will be checked
@param {string} path - The path down tree that leafVal is stored
@param {function} f - This is the function that reduces the unexplored subtree (e.g. hash) in the membership check
@param {Array<object>} acc - This is the array that contains the membership proof
@returns {Array<object>} An array containing the membership proof
*/
const _checkMembership = (leafVal, tree, path, f, acc) => {
  switch (tree.tag) {
    case 'branch':
      // If recurse left (i.e. '0'), we apply the function f to the right subtree  and vice versa
      // We also store the direction that f was applied (i.e. 'right' in the above case).
      return path[0] === '0'
        ? _checkMembership(
            leafVal,
            tree.left,
            path.slice(1),
            f,
            [{ dir: 'right', value: f(tree.right) }].concat(acc),
          )
        : _checkMembership(
            leafVal,
            tree.right,
            path.slice(1),
            f,
            [{ dir: 'left', value: f(tree.left) }].concat(acc),
          );

    case 'leaf':
      // If we arrive at a leaf, we check if the value at the leaf matches the element we are looking for.
      return tree.value !== leafVal ? { isMember: false, path: [] } : { isMember: true, path: acc };
    default:
      return { isMember: false, path: [] };
  }
};

/**
@function _combineFrontiers
* @param arr1 - An array of hashes (frontier points)
* @param arr2 - An array of hashes (frontier points)
* @returns An array of hashes, where the hashes of the longer arrays supersedes hashes those in the shorter
* array at the same indices
 */
const combineFrontiers = (arr1, arr2) => {
  if (arr1.length > arr2.length) {
    const fromArr1 = arr1.slice(arr2.length);
    return arr2.concat(fromArr1);
  }
  const fromArr2 = arr2.slice(arr1.length);
  return arr1.concat(fromArr2);
};

/**
@class
Creates a timber library instance. The constructor is designed to enable the recreation of a timber instance
@param {string} root - Root of the timber tree
@param {object} tree  - Tree object to use
@param {Array<string>} frontier - frontier of this tree
@param {number} leafCount - number of leaves in the tree

*/
class Timber {
  root;

  tree = Leaf(0);

  frontier = [];

  leafCount = 0;

  constructor(root = 0, tree = Leaf(0), frontier = [], leafCount = 0) {
    if (root === 0 || tree === Leaf(0) || frontier.length === 0 || leafCount === 0) return this;
    this.root = root;
    this.tree = tree;
    this.frontier = frontier;
    this.leafCount = leafCount;
    return this;
  }

  /**
  @method
  This helpfully traverse the tree to apply the function to all leaves.
  @param {function} f - A function that operates on strings stored in Leaf values
  @param {object} tree - The tree to be traversed
  @returns {object} - The tree with f applied to all leaves
  */
  static mapTree(f, tree) {
    switch (tree.tag) {
      case 'branch':
        return Branch(this.mapTree(f, tree.left), this.mapTree(f, tree.right));
      case 'leaf':
        return Leaf(f(tree.value));
      default:
        return tree;
    }
  }

  /**
  @method
  This is like mapTree except the values are accumulated to the root
  @param {function} f - A binary (as in two parameters) function that operates on strings stored in Leaf values
  @param {object} tree - The tree to be traversed
  @returns {string} The result of the accumulations as due to f
  */
  static reduceTree(f, tree) {
    switch (tree.tag) {
      case 'branch':
        return f(this.reduceTree(f, tree.left), this.reduceTree(f, tree.right));
      case 'leaf':
        return tree.value;
      default:
        return tree;
    }
  }

  /**
  @method
  This hashes the tree
  @param {object} tree - The tree that will be hashed
  @returns {string} The hash result;
  */
  static hashTree(tree) {
    return Timber.reduceTree(utils.concatenateThenHash, tree);
  }

  /**
  @method
  This moves our "focus" from the current node down to a subtree
  @param {object} tree - The tree where our focus is currently at the root of
  @param {string} dir - The element '0' or '1' that decides if we go left or right.
  @returns {object} The subtree where our focus is currently at the root of.
  */
  static moveDown(tree, dirs) {
    if (dirs.length === 0) return tree;
    if (Number(dirs[0]) > 1 || Number(dirs[0]) < 0) throw new Error('Invalid Dir');
    switch (tree.tag) {
      case 'branch':
        return dirs[0] === '0'
          ? this.moveDown(tree.left, dirs.slice(1))
          : this.moveDown(tree.right, dirs.slice(1));
      default:
        return tree;
    }
  }

  /**
  @method
  This gets the path from a leafValue to the root.
  @param {string} leafValue - The leafValue to get the path of.
  @param {string} index - The index that the leafValue is located at.
  @returns {Array<object>} The merkle path for leafValue.
  */
  getMerklePath(leafValue, index = -1) {
    // eslint-disable-next-line no-param-reassign
    if (index === -1) index = this.toArray().findIndex(comm => comm === leafValue);
    if (index > this.leafCount || index < 0) throw new Error('Index is outside valid leaf count');
    const indexBinary = Number(index).toString(2).padStart(TIMBER_HEIGHT, '0');
    return _checkMembership(leafValue, this.tree, indexBinary, Timber.hashTree, []);
  }

  /**
  @method
  This verifies a merkle path for a given leafValue
  @param {string} leafValue - The leafValue to get the path of.
  @param {string} root - The root that the merkle proof should verify to.
  @param {Array<object>} proofPath - The output from getMerklePath.
  @returns {boolean} If a path is true or false.
  */
  static verifyMerklePath(leafValue, root, proofPath) {
    const calcRoot = proofPath.path.reduce((acc, curr) => {
      if (curr.dir === 'right') return utils.concatenateThenHash(acc, curr.value);
      return utils.concatenateThenHash(curr.value, acc);
    }, leafValue);
    return calcRoot === root;
  }

  /**
  @method
  This calculates the frontier for a tree
  @param {object} tree - The tree where our focus is currently at the root of
  @param {string} index - The index that the leafValue is located at.
  @returns {Array<object>} The merkle path for leafValue.
  */
  static calcFrontier(tree, leafCount, height = TIMBER_HEIGHT) {
    // The base case - there are no leaves in this tree.
    if (leafCount === 0) return [];
    // If there are some leaves in this tree, we can make our life easier
    // by locating "full" subtrees. We do this by using the height and leaf count
    const width = leafCount > 1 ? 2 ** Math.ceil(height) : 2;
    const numFrontierPoints = Math.floor(Math.log2(leafCount)) + 1;

    if (leafCount === width) {
      // If this tree is full, we have a deterministic way to discover the frontier values
      // Dirs is an array of directions: ['0','10','110'...]
      const dirs = [...Array(numFrontierPoints - 1).keys()].map(a => '0'.padStart(a + 1, '1'));
      // The frontier points are then the root of the tree and our deterministic paths.
      return Timber.hashTree(tree).concat(
        dirs.map(fp => Timber.hashTree(Timber.moveDown(tree, fp))),
      );
    }
    // Our tree is not full at this height, but there will be a level where it will be full
    // unless there is only 1 leaf in this tree (which we will handle separately)

    // Firstly, we need to descend to a point where we are sitting over the subtree that form
    // the frontier points.
    const lastIdxBin = Number(leafCount - 1)
      .toString(2)
      .padStart(height, '0');

    const frontierTreeRoot = Timber.moveDown(tree, lastIdxBin.slice(0, height - numFrontierPoints));

    // If the leaf count is 1 then our only option is left of the current location.
    if (leafCount === 1) {
      return [Timber.moveDown(frontierTreeRoot, '0'.padStart(height, '0')).value];
    }

    const leftLeafCount = 2 ** Math.floor(Math.log2(leafCount));
    const rightLeafCount = leafCount - leftLeafCount;

    const leftSubTreeDirs = [...Array(numFrontierPoints - 1).keys()].map(a =>
      '0'.padStart(a + 1, '1'),
    );

    const leftTreeFrontierPoints = [Timber.hashTree(frontierTreeRoot.left)]
      .concat(
        leftSubTreeDirs.map(fp => Timber.hashTree(Timber.moveDown(frontierTreeRoot.left, fp))),
      )
      .reverse();

    // const newHeight = height - numFrontierPoints > 0 ? numFrontierPoints - 1 : height - 1;
    const newHeight = numFrontierPoints - 1;
    return combineFrontiers(
      leftTreeFrontierPoints,
      this.calcFrontier(frontierTreeRoot.right, rightLeafCount, newHeight),
    );
  }

  /**
  @method
  Inserts a single leaf into the tree
  @param {string} leafValue - The commitment that will be inserted.
  @returns {object} Updated timber instance.
  */
  insertLeaf(leafValue) {
    if (this.leafCount === TIMBER_WIDTH) throw new Error('Tree is Full');
    // New Leaf will be added at index leafCount - the leafCount is always one more than the index.
    const nextIndex = Number(this.leafCount).toString(2).padStart(TIMBER_HEIGHT, '0');

    const inputTree = this.tree;
    this.tree = _insertLeaf(leafValue, inputTree, nextIndex);
    this.leafCount += 1;
    this.root = Timber.hashTree(this.tree);
    this.frontier = Timber.calcFrontier(this.tree, this.leafCount);
    return this;
  }

  /**
  @method
  Inserts multiple  leaves into the tree
  @param {Array<string>} leafValues - The commitments that will be inserted.
  @returns {object} Updated timber instance.
  */
  insertLeaves(leafValues) {
    if (this.leafCount + leafValues.length > TIMBER_WIDTH)
      throw new Error('Cannot insert leaves as tree is/will be full');

    const idxValuePairs = [...Array(leafValues.length).keys()].map((a, i) => {
      const nodeIndex = Number(this.leafCount + a)
        .toString(2)
        .padStart(TIMBER_HEIGHT, '0');
      return [nodeIndex, leafValues[i]];
    });
    const inputTree = this.tree;
    this.tree = idxValuePairs.reduce((acc, curr) => _insertLeaf(curr[1], acc, curr[0]), inputTree);
    this.leafCount += leafValues.length;
    this.root = Timber.hashTree(this.tree);
    this.frontier = Timber.calcFrontier(this.tree, this.leafCount);
    return this;
  }

  /**
  @method
  This helpfully deletes the right subtree along a given path.
  @param {object} tree - The tree that deletion will be performed over.
  @param {string} pathToLeaf - The path along which every right subtree will be deleted.
  @returns {object} A tree after deletion
  */
  static pruneRightSubTree(tree, pathToLeaf) {
    switch (tree.tag) {
      case 'branch':
        return pathToLeaf[0] === '0'
          ? Branch(this.pruneRightSubTree(tree.left, pathToLeaf.slice(1)), Leaf(0)) // Going left, delete the right tree
          : Branch(tree.left, this.pruneRightSubTree(tree.right, pathToLeaf.slice(1))); // Going right, but leave the left tree intact
      case 'leaf':
        return tree;
      default:
        return tree;
    }
  }

  /**
  @method
  Rolls a tree back to a given leafcount
  @param {number} leafCount - The leafcount to which the tree should be rolled back to.
  @returns {object} - Updated timber instance.
  */
  rollback(leafCount) {
    if (leafCount > this.leafCount) throw new Error('Cannot rollback tree to desired leafcount');
    if (leafCount === this.leafCount) return this;
    const pathToNewLastElement = Number(leafCount - 1)
      .toString(2)
      .padStart(TIMBER_HEIGHT, '0');
    this.tree = Timber.pruneRightSubTree(this.tree, pathToNewLastElement);
    this.root = Timber.hashTree(this.tree);
    this.leafCount = leafCount;
    this.frontier = Timber.calcFrontier(this.tree, this.leafCount);
    return this;
  }

  /**
  @method
  Converts a tree to a array, this will include the zero elements.
  @returns {Array<string>} - Array of all the leaves in the tree including zero elements.
  */
  toArray() {
    return Timber.reduceTree((a, b) => [].concat([a, b]).flat(), this.tree);
  }
}

export default Timber;
