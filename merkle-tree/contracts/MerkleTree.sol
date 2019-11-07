pragma solidity ^0.5.8;

contract MerkleTree {

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

    event newLeaf(uint leafIndex, bytes32 leafValue); // This event is what the merkle-tree microservice's filter will listen for. We assume that some importing contract will be the one to actually emit this event, because it will be the importing contract which manages permissions for inserting a leaf into this tree.
    event Hash(bytes32 hash, uint row); // for debugging the hashing
    event Inputs(bytes32 left, bytes32 right); // for debugging the hashing

    bytes32 zero = 0x0000000000000000000000000000000000000000000000000000000000000000;
    uint public treeHeight;
    uint public treeWidth; // 2 ^ treeHeight
    bytes32[] public frontier; // the right-most 'frontier' of nodes required to calculate the new root when the next new leaf value is added.
    uint256 public leafCount; // the number of leaves currently in the tree

    constructor(uint _treeHeight) public {
        treeHeight = _treeHeight;
        treeWidth = 2 ** _treeHeight;
        frontier = new bytes32[](treeHeight + 1);
    }

    function getFrontierSlot(uint leafIndex) internal pure returns (uint slot) {
        slot = 0;
        if ( leafIndex % 2 == 0 ) {
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
        } else {
            slot = 0;
        }
    }

    function hash(bytes32[2] memory inputs) internal returns (bytes32[1] memory output) {
        bool success;
        assembly {
            /*
              * gasLimit: calling with gas equal to not(0), as we have here, will send all available gas to the function being called. This removes the need to guess or upper-bound the amount of gas being sent yourself. As an alternative, we could have guessed the gas needed with: sub(gas, 2000)
              * to: the sha256 precompiled contract is at address 0x2: Sending the amount of gas currently available to us (or after subtracting 2000 gas if using the alternative mentioned above);
              * value: 0 (no ether will be sent to the contract)
              * inputOffset: Input data to the sha256 precompiled contract.
              * inputSize: hex input size = 0x40 = 2 x 32-bytes
              * outputOffset: "where will the output be stored?" (in variable 'output' in our case)
              * outputSize: sha256 outputs 256-bits = 32-bytes = 0x20 in hex
            */
            success := call(not(0), 2, 0, inputs, 0x40, output, 0x20)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
    }

    /**
    Updates each node of the Merkle Tree on the path from leaf to root.
    leafIndex - is the leafIndex of the new leaf within Merkle Tree's leaves.

    If L were the new leaf, then the p's mark the 'path', and the s's mark the 'sibling path'
                     p
                /         \
            p                  s
         /     \             /   \
       s         p        EF        GH
     /  \      /  \      /  \      /  \
    A    B    L    s    E    F    G    H
    */
    function updatePathToRoot(uint leafIndex, bytes32 leafValue) public returns (bytes32) {

        uint slot = getFrontierSlot(leafIndex);
        uint nodeIndex = leafIndex + treeWidth - 2;
        uint parentIndex; // temporary index for the parent of the nodeIndex.
        bytes32 nodeValue = leafValue; // nodeValue is the hash, which iteratively gets overridden to the top of the tree until it becomes the root.
        // emit Hash(h, merkleDepth);
        bytes32[2] memory inputs; // the left and right inputs to the hash function.


        for (uint level = 0; level < treeHeight; level++) {

            if (level == slot) frontier[slot] = nodeValue;

            if (nodeIndex % 2 == 0) { // even nodeIndex
                parentIndex = (nodeIndex - 1) / 2;
                // emit Inputs(merkleStack[r],h);
                inputs[0] = frontier[level];
                inputs[1] = nodeValue;

                nodeValue = hash(inputs)[0];
                // emit Hash(nodeValue, row);
            } else { // odd nodeIndex
                parentIndex = nodeIndex / 2;
                // emit Inputs(nodeValue, zero);
                inputs[0] = nodeValue;
                inputs[1] = zero;

                nodeValue = hash(inputs)[0];
                // emit Hash(h, r);
            }
            nodeIndex = parentIndex; // move one row up the tree
        }

        frontier[treeHeight] = nodeValue; // store the root TODO: NOT NEEDED HERE; should be absorbed into the controller contract
        return nodeValue; //the root of the tree
    }
}
