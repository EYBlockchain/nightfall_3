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
        ? Branch(_insertLeaf(leafVal, Leaf('0'), path.slice(1)), Leaf('0'))
        : Branch(Leaf('0'), _insertLeaf(leafVal, Leaf('0'), path.slice(1)));
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
This function converts a frontier array into a tree (unbalanced), this is useful if we need a tree-like structure to add
new leaves to.
@function frontierToTree
 * @param timber - A timber instance whose frontier we want to tree-ify
 * @returns An object that represents a tree formed from the frontier.
 */
const frontierToTree = timber => {
  if (timber.frontier.length === 0) return Leaf('0');
  const currentFrontierSlotArray = Array(timber.frontier.length)
    .fill(timber.leafCount)
    .map((a, i) => Math.floor(a / 2 ** i));
  const frontierPaths = [];
  for (let i = 0; i < timber.frontier.length; i++) {
    if (currentFrontierSlotArray[i] % 2 === 0)
      frontierPaths.push(
        Number(currentFrontierSlotArray[i] - 2)
          .toString(2)
          .padStart(TIMBER_HEIGHT, '0')
          .slice(0, TIMBER_HEIGHT - i),
      );
    else
      frontierPaths.push(
        Number(currentFrontierSlotArray[i] - 1)
          .toString(2)
          .padStart(TIMBER_HEIGHT, '0')
          .slice(0, TIMBER_HEIGHT - i),
      );
  }
  return timber.frontier.reduce((acc, curr, index) => {
    return _insertLeaf(curr, acc, frontierPaths[index]);
  }, timber.tree);
};

/**
We do batch insertions when doing stateless operations, the size of each batch is dependent on the tree structure.
Each batch insert has to less than or equal to the next closest power of two - otherwise we may unbalance the tree.
E.g. originalLeafCount = 2, leaves.length = 9 -> BatchInserts = [2,4,3]
@function batchLeaves
 * @param originalLeafCount - The leaf count of the tree we want to insert into.
 * @param leaves - The elements to be inserted into the tree
 * @param acc - Used to eliminate tail calls and make recursion more efficient.
 * @returns An array of arrays containing paritioned elements of leaves, in the order to be inserted.
 */
const batchLeaves = (originalLeafCount, leaves, acc) => {
  if (leaves.length === 0) return acc;
  const outputLeafCount = originalLeafCount + leaves.length;
  const outputFrontierLength = Math.floor(Math.log2(outputLeafCount)) + 1;

  // This is an array that counts the number of perfect trees at each depth for the current frontier.
  // This is padded to be as long as the resultingFrontierSlot.
  const currentFrontierSlotArray = Array(outputFrontierLength)
    .fill(originalLeafCount)
    .map((a, i) => Math.floor(a / 2 ** i));

  // The height of the subtree that would be created by the new leaves
  const subTreeHeight = Math.ceil(Math.log2(leaves.length));

  // Since we are trying to add in batches, we have to be sure that the
  // new tree created from the incoming leaves are added correctly to the existing tree
  // We need to work out if adding the subtree directly would impact the balance of the tree.
  // We achieve this by identifying if the perfect tree count at the height of the incoming tree, contains any odd counts

  const oddDepths = currentFrontierSlotArray.slice(0, subTreeHeight).map(a => a % 2 !== 0); // && subTreeFrontierSlotArray[i] > 0);

  // If there are odd counts, we fix the lowest one first
  const oddIndex = oddDepths.findIndex(a => a);
  if (oddIndex >= 0) {
    // We can "round a tree out" (i.e. make it perfect) by inserting 2^depth leaves from the incoming set first.
    const leavesToSlice = 2 ** oddIndex;
    const newLeaves = leaves.slice(leavesToSlice);
    return batchLeaves(
      originalLeafCount + leavesToSlice,
      newLeaves,
      acc.concat([leaves.slice(0, leavesToSlice)]),
    );
  }
  return acc.concat([leaves]);
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

  tree = Leaf('0');

  frontier = [];

  leafCount = 0;

  constructor(root = 0, frontier = [], leafCount = 0, tree = Leaf('0')) {
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
    // return Timber.reduceTree((a,b) => a + '|' + b, tree);
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
  @returns {Array<object>} The sibling path for leafValue.
  */
  getSiblingPath(leafValue, index = -1) {
    if (this.leafCount === 0) return { isMember: false, path: [] };
    // eslint-disable-next-line no-param-reassign
    if (index === -1) index = this.toArray()?.findIndex(comm => comm === leafValue);
    if (index > this.leafCount || index < 0) throw new Error('Index is outside valid leaf count');
    const indexBinary = Number(index).toString(2).padStart(TIMBER_HEIGHT, '0');
    return _checkMembership(leafValue, this.tree, indexBinary, Timber.hashTree, []);
  }

  /**
  @method
  This verifies a sibling path for a given leafValue
  @param {string} leafValue - The leafValue to get the path of.
  @param {string} root - The root that the merkle proof should verify to.
  @param {Array<object>} proofPath - The output from getSiblingPath.
  @returns {boolean} If a path is true or false.
  */
  static verifySiblingPath(leafValue, root, proofPath) {
    if (proofPath.path.length === 0) return false;
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
  @param {string} leafCount - leafCount of the tree
  @param {number} height - The height of the current tree, defaults to the TIMBER_HEIGHT
  @returns {Array<string>} The frontier gor the given tree
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
      return [Timber.hashTree(tree)].concat(
        dirs.map(fp => Timber.hashTree(Timber.moveDown(tree, fp))),
      );
    }
    // Our tree is not full at this height, but there will be a level where it will be full
    // unless there is only 1 leaf in this tree (which we will handle separately)

    // Firstly, we need to descend to a point where we are sitting over the subtree that form
    // the frontier points.
    const lastIndex = Number(leafCount - 1)
      .toString(2)
      .padStart(height, '0');

    const frontierTreeRoot = Timber.moveDown(tree, lastIndex.slice(0, height - numFrontierPoints));

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
    if (leafValues.length === 0) return this;
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
          ? Branch(this.pruneRightSubTree(tree.left, pathToLeaf.slice(1)), Leaf('0')) // Going left, delete the right tree
          : Branch(tree.left, this.pruneRightSubTree(tree.right, pathToLeaf.slice(1))); // Going right, but leave the left tree intact
      case 'leaf':
        return tree;
      default:
        return tree;
    }
  }

  /**
  @method
  This function updates the root, frontier and leafCount of a given timber instance based on incoming new leaves
  It does not update the tree - hence 'stateless', this is useful if we dont store the tree.
  * @param {object} timber - The timber instance that will be statelessly updated
  * @param {Array<string>} leaves - The incoming new leaves
  * @returns {object} A timber instance where everything but the tree is updated.
  */
  static statelessUpdate(timber, leaves) {
    if (leaves.length === 0) return timber;
    if (timber.leafCount === 0)
      // If the timber tree is empty, it's much simpler insert the leaves anyways.
      return new Timber().insertLeaves(leaves);

    // Since we cannot rely on timber.tree, we have to work out how "full" the trees are
    // at each level using only their respective leaf counts.
    const outputLeafCount = timber.leafCount + leaves.length;
    const outputFrontierLength = Math.floor(Math.log2(outputLeafCount)) + 1;

    // This is an array that counts the number of perfect trees at each depth for the final frontier.
    // E.g timber.leafCount = 8 --> [8, 4 , 2, 1]
    const resultingFrontierSlot = Array(outputFrontierLength)
      .fill(outputLeafCount)
      .map((a, i) => Math.floor(a / 2 ** i));

    // This is an array that counts the number of perfect trees at each depth for the current frontier.
    // This is padded to be as long as the resultingFrontierSlot.
    const currentFrontierSlotArray = Array(outputFrontierLength)
      .fill(timber.leafCount)
      .map((a, i) => Math.floor(a / 2 ** i));

    // This is the array for the subtree frontier positions should be
    // this is calculated from the final and current frontier.
    // We back-calculate this as it helps work out the intermediate frontier
    const subTreeFrontierSlotArray = resultingFrontierSlot.map(
      (a, i) => a - currentFrontierSlotArray[i],
    );

    // The height of the subtree that would be created by the new leaves
    const subTreeHeight = Math.ceil(Math.log2(leaves.length));

    // Since we are trying to add in batches, we have to be sure that the
    // new tree created from the incoming leaves are added correctly to the existing tree
    // We need to work out if adding the subtree directly would impact the balance of the tree.
    // We achieve this by identifying if the perfect tree count at the height of the incoming tree, contains any odd counts

    const oddDepths = currentFrontierSlotArray.slice(0, subTreeHeight).map(a => a % 2 !== 0); // && subTreeFrontierSlotArray[i] > 0);

    // If there are odd counts, we fix the lowest one first
    const oddIndex = oddDepths.findIndex(a => a);
    if (oddIndex >= 0) {
      // We can "round a tree out" (i.e. make it perfect) by inserting 2^depth leaves from the incoming set first.
      const leavesToSlice = 2 ** oddIndex;
      const newLeaves = leaves.slice(leavesToSlice);
      const newTimber = this.statelessUpdate(timber, leaves.slice(0, leavesToSlice)); // Update our frontier
      return this.statelessUpdate(newTimber, newLeaves);
    }

    // If we get to this point, then are inserting our leaves into an existing balanced tree
    // This is ideal as it means we can batch insert out incoming leaves by making it into a mini-tree

    // This is the subtree consisting of the new leaves.
    const newSubTree = new Timber().insertLeaves(leaves);

    // We use spread operator here to prevent javascript call-by-sharing
    const paddedSubTreeFrontier = [...newSubTree.frontier];

    // Now we check if the calculated slots for the subtree frontier match the frontier we have calculated
    // as we may have increased the height of our tree.
    if (newSubTree.frontier.length < subTreeFrontierSlotArray.filter(f => f !== 0).length) {
      for (let i = newSubTree.frontier.length; i < subTreeFrontierSlotArray.length; i++) {
        paddedSubTreeFrontier[i] = utils.concatenateThenHash(
          timber.frontier[i - 1],
          paddedSubTreeFrontier[i - 1],
        );
      }
    }

    // Now we can calculate the updated frontiers based on all our information.
    const finalFrontier = [];
    for (let i = 0; i < resultingFrontierSlot.length; i++) {
      const currentFrontierSlot = currentFrontierSlotArray[i];
      const subTreeFrontierSlot = subTreeFrontierSlotArray[i];

      // if (currentFrontierSlot === 0 && subTreeFrontierSlot === 0)
      //   finalFrontier.push(
      //     utils.concatenateThenHash(timber.frontier[i - 1], newSubTree.frontier[i - 1]),
      //   );

      // The rules for deciding if we should pick the existing frontier or override it with
      // the frontier from the newly created subtree.
      // 1) If either perfect tree counts at a depth are zero, we select the non-zero (our previous padding guarantees at least one is non-zero)
      // 2) If the perfect tree count for the existing tree is odd at a given depth, we select the frontier from the existing tree.
      //    This is because we know the perfect tree count for the incoming tree will be 1 (if it was > 1 we would need to do a small batch insert)
      // 3) If the perfect tree count for the existing tree is even at a given depth, we select the frontier from the incoming tree
      //    This is because the incoming tree will add to the perfect tree count and move the frontier to the right.
      if (currentFrontierSlot === 0) finalFrontier.push(paddedSubTreeFrontier[i]);
      else if (subTreeFrontierSlot === 0) finalFrontier.push(timber.frontier[i]);
      else if (currentFrontierSlot % 2 !== 0) finalFrontier.push(timber.frontier[i]);
      // ^-- This is safe because we ensure that subTreeFrontierSlot at this point can only be 1
      else finalFrontier.push(paddedSubTreeFrontier[i]);
    }

    // Let's calculate the updated root now.
    // const highestFrontier = Timber.calcRoot(timber.frontier, currentFrontierSlotArray, newSubTree);
    const rightMostElementSubTree = Number(newSubTree.leafCount - 1)
      .toString(2)
      .padStart(TIMBER_HEIGHT, '0');
    // This is the height of our sub tree.
    const treeHeight = Math.ceil(Math.log2(newSubTree.leafCount));

    // We can shortcut the root hash process by hashing our subtree.
    let root = Timber.hashTree(
      Timber.moveDown(
        newSubTree.tree,
        rightMostElementSubTree.slice(0, TIMBER_HEIGHT - treeHeight),
      ),
    );

    // Now we update the root hash by moving up to the height of the existing timber tree
    // If the root matches the timber frontier at that height - we hash it with zero
    // Otherwise we hash the frontier with our current root.
    for (let i = treeHeight; i < timber.frontier.length; i++) {
      // We do this zero check because of past padding
      if (currentFrontierSlotArray[i] % 2 === 0) root = utils.concatenateThenHash(root, '0');
      else if (root === timber.frontier[i]) root = utils.concatenateThenHash(root, '0');
      else root = utils.concatenateThenHash(timber.frontier[i], root);
    }
    // From the last frontier of the existing tree, we hash up to the full height with zeroes
    for (let j = timber.frontier.length; j < TIMBER_HEIGHT; j++) {
      root = utils.concatenateThenHash(root, '0');
    }
    const t = new Timber(root, finalFrontier, timber.leafCount + leaves.length);
    return t;
  }

  /**
  @method
  This function statelessly (i.e. does not modify timber.tree) calculates the sibling path for the element leaves[leafIndex].
  It only requires the frontier and leafCount to do so.
   * @param timber - The timber instance that contains the frontier and leafCount.
   * @param leaves - The elements that will be inserted.
   * @param leafIndex - The index in leaves that the sibling path will be calculated for.
   * @returns An object { isMember: bool, path: Array<{dir: 'string',value: string }> } representing the sibling path for that element.
   */
  static statelessSiblingPath(timber, leaves, leafIndex) {
    if (leaves.length === 0 || leafIndex >= leaves.length || leafIndex < 0)
      return { isMember: false, path: [] };
    const leavesInsertOrder = batchLeaves(timber.leafCount, leaves, []);
    const leafVal = leaves[leafIndex];
    const leafIndexAfterInsertion = leafIndex + timber.leafCount;

    const frontierTree = frontierToTree(timber);
    const finalTree = leavesInsertOrder.reduce(
      (acc, curr) => acc.insertLeaves(curr),
      new Timber(timber.root, timber.frontier, timber.leafCount, frontierTree),
    );

    return finalTree.getSiblingPath(leafVal, leafIndexAfterInsertion);
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

    this.tree =
      leafCount === 0 ? Leaf('0') : Timber.pruneRightSubTree(this.tree, pathToNewLastElement);
    this.leafCount = leafCount;
    this.frontier = Timber.calcFrontier(this.tree, this.leafCount);
    this.root = Timber.hashTree(this.tree);
    return this;
  }

  /**
  @method
  Converts a tree to a array, this will include the zero elements.
  @returns {Array<string>} - Array of all the leaves in the tree including zero elements.
  */
  toArray() {
    if (this.leafCount === 0) return [];
    return Timber.reduceTree((a, b) => [].concat([a, b]).flat(), this.tree);
  }
}

export default Timber;
