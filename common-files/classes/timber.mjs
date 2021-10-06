/* eslint import/no-extraneous-dependencies: "off" */
/* ignore unused exports */

/**
A class for timber-like merkle trees.
*/

import config from 'config';
import utils from '../utils/crypto/merkle-tree/utils.mjs';

const { TIMBER_HEIGHT, ZERO } = config;
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
        ? Branch(_insertLeaf(leafVal, Leaf(ZERO), path.slice(1)), Leaf(ZERO))
        : Branch(Leaf(ZERO), _insertLeaf(leafVal, Leaf(ZERO), path.slice(1)));
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
@class
Creates a timber library instance.
@param {Array<string>} leaves - Leaves that should be inserted into timber
*/
class Timber {
  root = ZERO;

  tree = Leaf(ZERO);

  frontier = [];

  leafCount = 0;

  constructor(leaves = []) {
    return this.insertLeaves(leaves);
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
  static moveDown(tree, dir) {
    if (Number(dir) > 1 || Number(dir) < 0) throw new Error('Invalid Dir');
    switch (tree.tag) {
      case 'branch':
        return dir === '0' ? tree.left : tree.right;
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
  static calcFrontier(tree, leafCount) {
    // If the tree is full the Frontier is trivially all the rightmost elements.
    if (leafCount === TIMBER_WIDTH) {
      const lastElementIndex = Number(TIMBER_WIDTH - 1)
        .toString(2)
        .split('');

      // eslint-disable-next-line prettier/prettier, no-return-assign, no-param-reassign
      return  [Timber.hashTree(tree)].concat(lastElementIndex.map((a => e => a = Timber.hashTree(Timber.moveDown(a, e)))(tree)));
      // The above line is moves our pointer down the tree, hashing and storing the value after each step.
    }
    const lastIdx = leafCount - 1;
    const frontierCount = Math.floor(Math.log2(leafCount)) + 1;
    const lastIdxBin = Number(lastIdx).toString(2).padStart(TIMBER_HEIGHT, '0');
    // Move our focus to the subtree that contains the frontier elements
    const frontierTreeRoot = lastIdxBin
      .slice(0, TIMBER_HEIGHT - frontierCount)
      .split('')
      .reduce((acc, curr) => Timber.moveDown(acc, curr), tree);

    const subTreePath = lastIdxBin.slice(-frontierCount);
    const frontierPoints = []; // This will be an array of arrays that contain the path to each frontier point.
    for (let i = 1; i <= subTreePath.length; i++) {
      // We use i = 1 here because we never consider the first element and always look one element ahead
      // this aesthetically saves repeated i + 1
      const lastPathDir = subTreePath[i]; // The last direction to the (i-1)-th frontier point
      if (lastPathDir === '0') {
        // If our sequence ends in a 0, then we invert the path to arrive at the predecessor node.
        frontierPoints.push(
          subTreePath
            .slice(0, i)
            .split('')
            .map(s => (s === '0' ? '1' : '0')),
        );
      } else frontierPoints.push(subTreePath.slice(0, i).split(''));
    }
    // We move our focus from the current tree to each frontier point, resulting in a array of subtrees.
    // The roots of these subtrees are the frontier points, so we hash each of the subtrees.
    return frontierPoints.map(fp =>
      Timber.hashTree(fp.reduce((acc, curr) => Timber.moveDown(acc, curr), frontierTreeRoot)),
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
          ? Branch(this.pruneRightSubTree(tree.left, pathToLeaf.slice(1)), Leaf(ZERO)) // Going left, delete the right tree
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
    if (leafCount === 0) return new Timber();
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
