// SPDX-License-Identifier: CC0-1.0
/**
A base contract which handles Merkle Tree inserts.
The intention is for other 'derived' contracts to import this contract, and for those derived contracts to manage permissions to actually call the insertLeaf/insertleaves functions of this base contract.

*Note* that this version has been modified so that it does not store any state,
Thus, it is up to the calling contract to store the updated leafCount, frontier and root; these values being returned. This is so MerkleTree.sol can be called to test if an optimistic proposal is valid, without having the Merkle tree updated with what might not be valid information (and will probably be out-of-sequence information). This means all functions are pure.

@Author iAmMichaelConnor
*/

pragma solidity ^0.6.0;

import "./MiMC.sol"; // import contract with MiMC function

contract MerkleTree_Stateless is MiMC {

    /*
    @notice Explanation of the Merkle Tree in this contract:
    This is an append-only merkle tree; populated from left to right.
    We do not store all of the merkle tree's nodes. We only store the right-most 'frontier' of nodes required to calculate the new root when the next new leaf value is added.

                      TREE (not stored)                       FRONTIER (stored)

                                 0                                     ?
                          /             \
                   1                             2                     ?
               /       \                     /       \
           3             4               5               6             ?
         /   \         /   \           /   \           /    \
       7       8      9      10      11      12      13      14        ?
     /  \    /  \   /  \    /  \    /  \    /  \    /  \    /  \
    15  16  17 18  19  20  21  22  23  24  25  26  27  28  29  30      ?

    level  row  width  start#     end#
      4     0   2^0=1   w=0     2^1-1=0
      3     1   2^1=2   w=1     2^2-1=2
      2     2   2^2=4   w=3     2^3-1=6
      1     3   2^3=8   w=7     2^4-1=14
      0     4   2^4=16  w=15    2^5-1=30

    height = 4
    w = width = 2 ** height = 2^4 = 16
    #nodes = (2 ** (height + 1)) - 1 = 2^5-1 = 31

    */

    /**
    These events are what the merkle-tree microservice's filters will listen for.
    */
    event NewLeaf(uint leafIndex, bytes32 leafValue, bytes32 root);
    event NewLeaves(uint minLeafIndex, bytes32[] leafValues, bytes32 root);

    event Output(bytes32[2] input, bytes32[1] output, uint prevNodeIndex, uint nodeIndex); // for debugging only

    uint constant treeHeight = 32; //change back to 32 after testing
    uint constant treeWidth = 2 ** treeHeight; // 2 ** treeHeight
    uint256 public leafCount; // the number of leaves currently in the tree. This storage variable must be updated by the calling function.  This version of MerkleTree does not do it automatically. That's so it can be used to compute the outcome of Challenges to an optimistic transaction.

    /*
    Whilst ordinarily, we'd work solely with bytes32, we need to truncate nodeValues up the tree. Therefore, we need to declare certain variables with lower byte-lengths:
    LEAF_HASHLENGTH = 32 bytes;
    NODE_HASHLENGTH = 27 bytes;
    5 byte difference * 8 bits per byte = 40 bit shift to truncate hashlengths.
    27 bytes * 2 inputs to sha() = 54 byte input to sha(). 54 = 0x36.
    If in future you want to change the truncation values, search for '27', '40' and '0x36'.
    */
    // bytes27 zero = 0x000000000000000000000000000000000000000000000000000000;

    //Changed to bytes32 for MiMC hashing
    bytes32 constant zero = 0x0000000000000000000000000000000000000000000000000000000000000000;
    bytes32[33] frontier; // the right-most 'frontier' of nodes required to calculate the new root when the next new leaf value is added. Note, the MerkleTree contract does not update this but just returns the current value.  The user must update this value from the calling contract.  This is because if we are challenging a block, we don't necessarily want to update this variable.  We only update the static frontier when transactions are incorporated into the shield state.

    /**
    @notice Get the index of the frontier (or 'storage slot') into which we will next store a nodeValue (based on the leafIndex currently being inserted). See the top-level README for a detailed explanation.
    @return slot uint - the index of the frontier (or 'storage slot') into which we will next store a nodeValue
    */
    function getFrontierSlot(uint leafIndex) public pure returns (uint slot) {
        slot = 0;
        if ( leafIndex % 2 == 1 ) {
            uint exp1 = 1;
            uint pow1 = 2;
            uint pow2 = pow1 << 1;
            while (slot == 0) {
                if ( (leafIndex + 1 - pow1) % pow2 == 0 ) {
                    slot = exp1;
                } else {
                    pow1 = pow2;
                    pow2 = pow2 << 1;
                    exp1++;
                }
            }
        }
    }

    /**
    @notice Insert a leaf into the Merkle Tree, update the root.  The user must
    update the persistently stored frontier based on the values returned here.
    @param leafValue - the value of the leaf being inserted.
    @param _frontier - current Frontier values
    @return root bytes32 - the root of the merkle tree, after the insert.
    @return _frontier bytes32[33] - the updated frontier
    */
    function insertLeaf(bytes32 leafValue, bytes32[33] memory _frontier, uint _leafCount) public pure returns (bytes32 root, bytes32[33] memory, uint) {

        // check that space exists in the tree:
        require(treeWidth > _leafCount, "There is no space left in the tree.");

        uint slot = getFrontierSlot(_leafCount);
        uint nodeIndex = _leafCount + treeWidth - 1;
        uint prevNodeIndex;
        bytes32 nodeValue = leafValue; // nodeValue is the hash, which iteratively gets overridden to the top of the tree until it becomes the root.

        //bytes32 leftInput; //can remove these and just use input[0] input[1]
        //bytes32 rightInput;
        bytes32[2] memory input; //input of the hash fuction
        bytes32[1] memory output; // output of the hash function

        for (uint level = 0; level < treeHeight; level++) {

            if (level == slot) _frontier[slot] = nodeValue;

            if (nodeIndex % 2 == 0) {
                // even nodeIndex
                input[0] = _frontier[level];
                input[1] = nodeValue;

                output[0] = mimcHash2(input); // mimc hash of concatenation of each node
                nodeValue = output[0]; // the parentValue, but will become the nodeValue of the next level
                prevNodeIndex = nodeIndex;
                nodeIndex = (nodeIndex - 1) / 2; // move one row up the tree
                // emit Output(input, output, prevNodeIndex, nodeIndex); // for debugging only
            } else {
                // odd nodeIndex
                input[0] = nodeValue;
                input[1] = zero;

                output[0] = mimcHash2(input); // mimc hash of concatenation of each node
                nodeValue = output[0]; // the parentValue, but will become the nodeValue of the next level
                prevNodeIndex = nodeIndex;
                nodeIndex = nodeIndex / 2; // move one row up the tree
                // emit Output(input, output, prevNodeIndex, nodeIndex); // for debugging only
            }
        }

        root = nodeValue;

        //emit NewLeaf(leafCount, leafValue, root); // this event is what the merkle-tree microservice's filter will listen for.

        _leafCount++; // the incrememnting of leafCount costs us 20k for the first leaf, and 5k thereafter

        return (root, _frontier, _leafCount); //the root of the tree
    }

    /**
    @notice Insert multiple leaves into the Merkle Tree, and then update the root, The user must update and persistently stored the new frontier.
    @param leafValues - the values of the leaves being inserted.
    @param _frontier - the current Frontier value
    @return root bytes32[] - the root of the merkle tree, after all the inserts.
    */
    function insertLeaves(bytes32[] memory leafValues, bytes32[33] memory _frontier, uint _leafCount) public pure returns (bytes32 root, bytes32[33] memory, uint) {

        uint numberOfLeaves = leafValues.length;

        // check that space exists in the tree:
        require(treeWidth > _leafCount, "There is no space left in the tree.");
        if (numberOfLeaves > treeWidth - _leafCount) {
            uint numberOfExcessLeaves = numberOfLeaves - (treeWidth - _leafCount);
            // remove the excess leaves, because we only want to emit those we've added as an event:
            for (uint xs = 0; xs < numberOfExcessLeaves; xs++) {
                /*
                  CAUTION!!! This attempts to succinctly achieve leafValues.pop() on a **memory** dynamic array. Not thoroughly tested!
                  Credit: https://ethereum.stackexchange.com/a/51897/45916
                */

                assembly {
                  mstore(leafValues, sub(mload(leafValues), 1))
                }
            }
            numberOfLeaves = treeWidth - _leafCount;
        }

        uint slot;
        uint nodeIndex;
        uint prevNodeIndex;
        bytes32 nodeValue;

        //bytes32 leftInput;
        //bytes32 rightInput;
        bytes32[2] memory input;
        bytes32[1] memory output; // the output of the hash

        // consider each new leaf in turn, from left to right:
        for (uint leafIndex = _leafCount; leafIndex < _leafCount + numberOfLeaves; leafIndex++) {
            nodeValue = leafValues[leafIndex - _leafCount];
            nodeIndex = leafIndex + treeWidth - 1; // convert the leafIndex to a nodeIndex

            slot = getFrontierSlot(leafIndex); // determine at which level we will next need to store a nodeValue

            if (slot == 0) {
                _frontier[slot] = nodeValue; // update Frontier
                continue;
            }

            // hash up to the level whose nodeValue we'll store in the frontier slot:
            for (uint level = 1; level <= slot; level++) {
                if (nodeIndex % 2 == 0) {
                    // even nodeIndex
                    input[0] = _frontier[level - 1]; //replace with push?
                    input[1] = nodeValue;
                    output[0] = mimcHash2(input); // mimc hash of concatenation of each node

                    nodeValue = output[0]; // the parentValue, but will become the nodeValue of the next level
                    prevNodeIndex = nodeIndex;
                    nodeIndex = (nodeIndex - 1) / 2; // move one row up the tree
                    // emit Output(input, output, prevNodeIndex, nodeIndex); // for debugging only
                } else {
                    // odd nodeIndex
                    input[0] = nodeValue;
                    input[1] = zero;
                    output[0] = mimcHash2(input); // mimc hash of concatenation of each node

                    nodeValue = output[0]; // the parentValue, but will become the nodeValue of the next level
                    prevNodeIndex = nodeIndex;
                    nodeIndex = nodeIndex / 2; // the parentIndex, but will become the nodeIndex of the next level
                    // emit Output(input, output, prevNodeIndex, nodeIndex); // for debugging only
                }
            }
            _frontier[slot] = nodeValue; // update frontier
        }

        // So far we've added all leaves, and hashed up to a particular level of the tree. We now need to continue hashing from that level until the root:
        for (uint level = slot + 1; level <= treeHeight; level++) {

            if (nodeIndex % 2 == 0) {
                // even nodeIndex
                input[0] = _frontier[level - 1];
                input[1] = nodeValue;
                output[0] = mimcHash2(input); // mimc hash of concatenation of each node

                nodeValue = output[0]; // the parentValue, but will become the nodeValue of the next level
                prevNodeIndex = nodeIndex;
                nodeIndex = (nodeIndex - 1) / 2;  // the parentIndex, but will become the nodeIndex of the next level
                // emit Output(input, output, prevNodeIndex, nodeIndex); // for debugging only
            } else {
                // odd nodeIndex
                input[0] = nodeValue;
                input[1] = zero;
                output[0] = mimcHash2(input); // mimc hash of concatenation of each node

                nodeValue = output[0]; // the parentValue, but will become the nodeValue of the next level
                prevNodeIndex = nodeIndex;
                nodeIndex = nodeIndex / 2;  // the parentIndex, but will become the nodeIndex of the next level
                // emit Output(input, output, prevNodeIndex, nodeIndex); // for debugging only
            }

        }

        root = nodeValue;

        //emit NewLeaves(_leafCount, leafValues, root); // this event is what the merkle-tree microservice's filter will listen for.

        _leafCount += numberOfLeaves; // the incrememnting of leafCount costs us 20k for the first leaf, and 5k thereafter
        return (root, _frontier, _leafCount); //the root of the tree
    }

    /**
    @notice Checks that a sibling path, given as a Merkle proof, is correct i.e. we can use it to 'ascend' the tree from the given leaf to the given root.
    @param siblingPath - the sibling path for the given leaf
    @param leafIndex - the index of the leaf to which the sibling path refers, i.e. it's leaf position, counting from the extreme left of the bottom of the Merkle Tree (first position = 0)
    @param node - the leaf value
    @param root - the root value
    @return bool - true if the siblingPath is valid, else false.
    @return _frontier - the nodes computed herein are actually the Timber Frontier for adding the next leaf.  This is jolly handy so we save them up.
    */
    function checkPath(bytes32[33] memory siblingPath, uint leafIndex, bytes32 node, bytes32 root) public pure returns(bool, bytes32[33] memory) {
      bytes32[33] memory _frontier;
      if (siblingPath[0] != root) return (false, _frontier); // check root of sibling path is actually the prior block root
      for (uint i = 32; i > 0; i--) {
        _frontier[i] = node;
        if (leafIndex % 2 == 0) node = mimcHash2([ node, siblingPath[i]]);
        else node = mimcHash2([ siblingPath[i], node]);
        leafIndex >> 1;
      }
      _frontier[0] = node;
      return (siblingPath[0] == node, _frontier);
    }
}
