// SPDX-License-Identifier: CC0-1.0

/**
A base contract which handles Merkle Tree inserts (and consequent updates to the root and 'frontier' (see below)).
The intention is for other 'derived' contracts to import this contract, and for those derived contracts to manage permissions to actually call the insertLeaf/insertleaves functions of this base contract.

*Note* that this version has been modified so that it does not store any state,
Thus, it is up to the calling contract to store the updated leafCount, frontier and root; these values being returned. This is so MerkleTree.sol can be called to test if an optimistic proposal is valid, without having the Merkle tree updated with what might not be valid information (and will probably be out-of-sequence information). This means all functions are pure.

@Author iAmMichaelConnor, ChaitanyaKonda
*/

pragma solidity ^0.8.0;

library MerkleTree_Stateless_KECCAK {
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

    /* event Output(
        bytes32 left,
        bytes32 right,
        bytes32[1] output,
        uint256 prevNodeIndex,
        uint256 nodeIndex
    ); // for debugging only */

    uint256 constant treeHeight = 5;
    uint256 constant treeWidth = 2**treeHeight; // 2 ** treeHeight

    bytes32 constant zero = 0x0000000000000000000000000000000000000000000000000000000000000000;

    /**
    @notice Get the index of the frontier (or 'storage slot') into which we will next store a nodeValue (based on the leafIndex currently being inserted). See the top-level README for a detailed explanation.
    @return slot - the index of the frontier (or 'storage slot') into which we will next store a nodeValue
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
    @notice Insert a leaf into the Merkle Tree, update the root, and update any values in the (persistently stored) frontier.
    @param leafValue - the value of the leaf being inserted.
    @return root - the root of the merkle tree, after the insert.
    */
    function insertLeaf(
        bytes32 leafValue,
        bytes32[treeHeight + 1] memory frontier,
        uint256 leafCount
    )
        public
        pure
        returns (
            bytes32 root,
            bytes32[treeHeight + 1] memory,
            uint256
        )
    {
        // check that space exists in the tree:
        require(treeWidth > leafCount, 'There is no space left in the tree.');

        uint256 slot = getFrontierSlot(leafCount);
        uint256 nodeIndex = leafCount + treeWidth - 1;
        bytes32 nodeValue = leafValue; // nodeValue is the hash, which iteratively gets overridden to the top of the tree until it becomes the root.

        bytes32 leftInput;
        bytes32 rightInput;
        bytes32[1] memory output; // output of the hash function

        for (uint256 level = 0; level < treeHeight; level++) {
            if (level == slot) frontier[slot] = nodeValue;

            if (nodeIndex % 2 == 0) {
                // even nodeIndex
                leftInput = frontier[level];
                rightInput = nodeValue;

                // compute the hash of the inputs:
                output[0] = keccak256(abi.encodePacked(leftInput, rightInput));

                nodeValue = output[0]; // the parentValue, but will become the nodeValue of the next level
                nodeIndex = (nodeIndex - 1) / 2; // move one row up the tree
            } else {
                // odd nodeIndex
                leftInput = nodeValue;
                rightInput = zero;

                // compute the hash of the inputs:
                output[0] = keccak256(abi.encodePacked(leftInput, rightInput));

                nodeValue = output[0]; // the parentValue, but will become the nodeValue of the next level
                nodeIndex = nodeIndex / 2; // move one row up the tree
            }
        }

        root = nodeValue;

        leafCount++; // the incrememnting of leafCount costs us 20k for the first leaf, and 5k thereafter

        return (root, frontier, leafCount); //the root of the tree
    }

    /**
    @notice Insert multiple leaves into the Merkle Tree, and then update the root, and update any values in the (persistently stored) frontier.
    @param leafValues - the values of the leaves being inserted.
    @return root - the root of the merkle tree, after all the inserts.
    */
    function insertLeaves(
        bytes32[] memory leafValues,
        bytes32[treeHeight + 1] memory frontier,
        uint256 leafCount
    )
        public
        pure
        returns (
            bytes32 root,
            bytes32[treeHeight + 1] memory,
            uint256
        )
    {
        uint256 numberOfLeaves = leafValues.length;

        // check that space exists in the tree:
        require(treeWidth > leafCount, 'There is no space left in the tree.');
        if (numberOfLeaves > treeWidth - leafCount) {
            uint256 numberOfExcessLeaves = numberOfLeaves - (treeWidth - leafCount);
            // remove the excess leaves, because we only want to emit those we've added as an event:
            for (uint256 xs = 0; xs < numberOfExcessLeaves; xs++) {
                /**
                  CAUTION!!! This attempts to succinctly achieve leafValues.pop() on a **memory** dynamic array. Not thoroughly tested!
                  Credit: https://ethereum.stackexchange.com/a/51897/45916
                */
                assembly {
                    mstore(leafValues, sub(mload(leafValues), 1))
                }
            }
            numberOfLeaves = treeWidth - leafCount;
        }

        uint256 slot;
        uint256 nodeIndex;
        /* uint256 prevNodeIndex; */
        bytes32 nodeValue;

        bytes32 leftInput;
        bytes32 rightInput;
        bytes32[1] memory output; // the output of the hash
        /* bool success; */

        // consider each new leaf in turn, from left to right:
        for (uint256 leafIndex = leafCount; leafIndex < leafCount + numberOfLeaves; leafIndex++) {
            nodeValue = leafValues[leafIndex - leafCount];
            nodeIndex = leafIndex + treeWidth - 1; // convert the leafIndex to a nodeIndex

            slot = getFrontierSlot(leafIndex); // determine at which level we will next need to store a nodeValue

            if (slot == 0) {
                frontier[slot] = nodeValue; // store in frontier
                continue;
            }

            // hash up to the level whose nodeValue we'll store in the frontier slot:
            for (uint256 level = 1; level <= slot; level++) {
                if (nodeIndex % 2 == 0) {
                    // even nodeIndex
                    leftInput = frontier[level - 1];
                    rightInput = nodeValue;
                    // compute the hash of the inputs:
                    output[0] = keccak256(abi.encodePacked(leftInput, rightInput));
                    nodeValue = output[0]; // the parentValue, but will become the nodeValue of the next level
                    /* prevNodeIndex = nodeIndex; */
                    nodeIndex = (nodeIndex - 1) / 2; // move one row up the tree
                    /* emit Output(leftInput, rightInput, output, prevNodeIndex, nodeIndex); // for debugging only */
                } else {
                    // odd nodeIndex
                    leftInput = nodeValue;
                    rightInput = zero;
                    // compute the hash of the inputs:
                    output[0] = keccak256(abi.encodePacked(leftInput, rightInput));
                    nodeValue = output[0]; // the parentValue, but will become the nodeValue of the next level
                    /* prevNodeIndex = nodeIndex; */
                    nodeIndex = nodeIndex / 2; // the parentIndex, but will become the nodeIndex of the next level
                    /* emit Output(leftInput, rightInput, output, prevNodeIndex, nodeIndex); // for debugging only */
                }
            }
            frontier[slot] = nodeValue; // store in frontier
        }

        // So far we've added all leaves, and hashed up to a particular level of the tree. We now need to continue hashing from that level until the root:
        for (uint256 level = slot + 1; level <= treeHeight; level++) {
            if (nodeIndex % 2 == 0) {
                // even nodeIndex
                leftInput = frontier[level - 1];
                rightInput = nodeValue;
                // compute the hash of the inputs:
                output[0] = keccak256(abi.encodePacked(leftInput, rightInput));
                nodeValue = output[0]; // the parentValue, but will become the nodeValue of the next level
                /* prevNodeIndex = nodeIndex; */
                nodeIndex = (nodeIndex - 1) / 2; // the parentIndex, but will become the nodeIndex of the next level
                /* emit Output(leftInput, rightInput, output, prevNodeIndex, nodeIndex); // for debugging only */
            } else {
                // odd nodeIndex
                leftInput = nodeValue;
                rightInput = zero;
                // compute the hash of the inputs:
                output[0] = keccak256(abi.encodePacked(leftInput, rightInput));
                nodeValue = output[0]; // the parentValue, but will become the nodeValue of the next level
                /* prevNodeIndex = nodeIndex; */
                nodeIndex = nodeIndex / 2; // the parentIndex, but will become the nodeIndex of the next level
                /* emit Output(leftInput, rightInput, output, prevNodeIndex, nodeIndex); // for debugging only */
            }
        }

        root = nodeValue;

        leafCount += numberOfLeaves; // the incrememnting of leafCount costs us 20k for the first leaf, and 5k thereafter

        return (root, frontier, leafCount); //the root of the tree
    }

    function checkPath(
        bytes32[treeHeight + 1] memory siblingPath,
        uint256 leafIndex,
        bytes32 node
    ) public pure returns (bool, bytes32[treeHeight + 1] memory) {
        bytes32[treeHeight + 1] memory frontier;

        for (uint256 i = treeHeight; i > 0; i--) {
            frontier[i] = node;
            if (leafIndex % 2 == 0) {
                node = keccak256(abi.encodePacked(node, siblingPath[i]));
            } else {
                node = keccak256(abi.encodePacked(siblingPath[i], node));
            }
            leafIndex = leafIndex >> 1;
        }
        frontier[0] = node;
        return (siblingPath[0] == node, frontier);
    }
}
