// SPDX-License-Identifier: CC0-1.0
/**
A base contract which handles Merkle Tree inserts.
The intention is for other 'derived' contracts to import this contract, and for those derived contracts to manage permissions to actually call the insertLeaf/insertleaves functions of this base contract.

*Note* that this version has been modified so that it does not store any state,
Thus, it is up to the calling contract to store the updated leafCount, frontier and root; these values being returned. This is so MerkleTree.sol can be called to test if an optimistic proposal is valid, without having the Merkle tree updated with what might not be valid information (and will probably be out-of-sequence information). This means all functions are pure.

@Author iAmMichaelConnor
*/

pragma solidity ^0.8.0;

import './Poseidon.sol'; //import contract with Poseidon function

library MerkleTree_Stateless {
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

    // event Output(bytes32[2] input, bytes32[1] output, uint prevNodeIndex, uint nodeIndex); // for debugging only

    uint256 constant treeHeight = 32; //change back to 32 after testing
    uint256 constant treeWidth = 2**treeHeight; // 2 ** treeHeight

    /*
    Whilst ordinarily, we'd work solely with bytes32, we need to truncate nodeValues up the tree. Therefore, we need to declare certain variables with lower byte-lengths:
    LEAF_HASHLENGTH = 32 bytes;
    NODE_HASHLENGTH = 27 bytes;
    5 byte difference * 8 bits per byte = 40 bit shift to truncate hashlengths.
    27 bytes * 2 inputs to sha() = 54 byte input to sha(). 54 = 0x36.
    If in future you want to change the truncation values, search for '27', '40' and '0x36'.
    */
    // bytes27 zero = 0x000000000000000000000000000000000000000000000000000000;

    /**
    @notice Get the index of the frontier (or 'storage slot') into which we will next store a nodeValue (based on the leafIndex currently being inserted). See the top-level README for a detailed explanation.
    @return slot uint - the index of the frontier (or 'storage slot') into which we will next store a nodeValue
    */
    function getFrontierSlot(uint256 leafIndex) public pure returns (uint256 slot) {
        slot = 0;
        if (leafIndex % 2 == 1) {
            uint256 exp1 = 1;
            uint256 pow1 = 2;
            uint256 pow2 = pow1 << 1;
            while (slot == 0) {
                if ((leafIndex + 1 - pow1) % pow2 == 0) {
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
    @notice Insert multiple leaves into the Merkle Tree, and then update the root, The user must update and persistently stored the new frontier.
    @param leafValues - the values of the leaves being inserted.
    @param _frontier - the current Frontier value
    @return root bytes32[] - the root of the merkle tree, after all the inserts.
    */
    function insertLeaves(
        bytes32[] memory leafValues,
        bytes32[33] memory _frontier,
        uint256 _leafCount
    )
        public
        pure
        returns (
            bytes32 root,
            bytes32[33] memory,
            uint256
        )
    {
        uint256 numberOfLeaves = leafValues.length;

        // check that space exists in the tree:
        require(treeWidth > _leafCount, 'There is no space left in the tree.');
        if (numberOfLeaves > treeWidth - _leafCount) {
            uint256 numberOfExcessLeaves = numberOfLeaves - (treeWidth - _leafCount);
            // remove the excess leaves, because we only want to emit those we've added as an event:
            for (uint256 xs = 0; xs < numberOfExcessLeaves; xs++) {
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

        uint256 slot;
        uint256 nodeIndex;
        uint256 prevNodeIndex;
        uint256 nodeValue;

        uint256 output; // the output of the hash

        // consider each new leaf in turn, from left to right:
        for (uint256 leafIndex = _leafCount; leafIndex < _leafCount + numberOfLeaves; leafIndex++) {
            nodeValue = uint256(leafValues[leafIndex - _leafCount]);
            nodeIndex = leafIndex + treeWidth - 1; // convert the leafIndex to a nodeIndex

            slot = getFrontierSlot(leafIndex); // determine at which level we will next need to store a nodeValue

            if (slot == 0) {
                _frontier[slot] = bytes32(nodeValue); // update Frontier
                continue;
            }

            // hash up to the level whose nodeValue we'll store in the frontier slot:
            for (uint256 level = 1; level <= slot; level++) {
                if (nodeIndex % 2 == 0) {
                    // even nodeIndex
                    output = Poseidon.poseidon(uint256(_frontier[level - 1]), nodeValue); // poseidon hash of concatenation of each node

                    nodeValue = output; // the parentValue, but will become the nodeValue of the next level
                    prevNodeIndex = nodeIndex;
                    nodeIndex = (nodeIndex - 1) / 2; // move one row up the tree
                    // emit Output(input, output, prevNodeIndex, nodeIndex); // for debugging only
                } else {
                    // odd nodeIndex
                    output = Poseidon.poseidon(nodeValue, 0); // poseidon hash of concatenation of each node

                    nodeValue = output; // the parentValue, but will become the nodeValue of the next level
                    prevNodeIndex = nodeIndex;
                    nodeIndex = nodeIndex / 2; // the parentIndex, but will become the nodeIndex of the next level
                    // emit Output(input, output, prevNodeIndex, nodeIndex); // for debugging only
                }
            }
            _frontier[slot] = bytes32(nodeValue); // update frontier
        }

        // So far we've added all leaves, and hashed up to a particular level of the tree. We now need to continue hashing from that level until the root:
        for (uint256 level = slot + 1; level <= treeHeight; level++) {
            if (nodeIndex % 2 == 0) {
                // even nodeIndex
                output = Poseidon.poseidon(uint256(_frontier[level - 1]), nodeValue); // poseidon hash of concatenation of each node

                nodeValue = output; // the parentValue, but will become the nodeValue of the next level
                prevNodeIndex = nodeIndex;
                nodeIndex = (nodeIndex - 1) / 2; // the parentIndex, but will become the nodeIndex of the next level
                // emit Output(input, output, prevNodeIndex, nodeIndex); // for debugging only
            } else {
                // odd nodeIndex
                output = Poseidon.poseidon(nodeValue, 0); // poseidon hash of concatenation of each node

                nodeValue = output; // the parentValue, but will become the nodeValue of the next level
                prevNodeIndex = nodeIndex;
                nodeIndex = nodeIndex / 2; // the parentIndex, but will become the nodeIndex of the next level
                // emit Output(input, output, prevNodeIndex, nodeIndex); // for debugging only
            }
        }

        root = bytes32(nodeValue);

        //emit NewLeaves(_leafCount, leafValues, root); // this event is what the merkle-tree microservice's filter will listen for.

        _leafCount += numberOfLeaves; // the incrememnting of leafCount costs us 20k for the first leaf, and 5k thereafter
        return (root, _frontier, _leafCount); //the root of the tree
    }
}
