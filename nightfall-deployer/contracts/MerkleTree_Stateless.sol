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
    @notice Insert multiple leaves into the Merkle Tree, and then update the root, The user must update and persistently stored the new frontier.
    @param _frontier - the current Frontier value
    @param _leafCount - the number of leaves
    */
    function calculateRoot(
        bytes32[33] memory _frontier,
        uint256 _leafCount
    )
        public 
        returns (bytes32 root)
    {

        address addr = address(Poseidon);
        bytes4 sig = bytes4(keccak256("poseidon(uint256,uint256)")); //Function signature

        uint256 nodeValue = 0;
        uint256 nodeIndex = 0;

        uint256 slot = 0;

        assembly {

            let x := mload(0x40)

            function getFrontierSlot(index)-> slotFrontier {
                slotFrontier := 0
                if eq(mod(index, 2),1) {
                    let exp1 := 1
                    let pow1 := 2
                    for { } eq(slotFrontier, 0) { } {
                        switch eq(mod(sub(add(index, 1), pow1), shl(1, pow1)),0)
                        case true {
                            slotFrontier:= exp1
                        }
                        case false {
                            pow1 := shl(1, pow1)
                            exp1 := add(exp1, 1)
                        }
                    }
                }
            }

            slot := getFrontierSlot(sub(_leafCount, 1)) // Get most recently updated frontier depth
            nodeValue := mload(add(_frontier, mul(0x20, slot))) // Assign the current node value to the frontier at this depth

            nodeIndex := shr(slot, sub(_leafCount,1)) // Get index of the frontier node from the leaf index (using bit-decomposition)

            // So far we've added all leaves, and hashed up to a particular level of the tree. We now need to continue hashing from that level until the root:
            // We use slot + 1 to get the parent node of our current nodeValue
            for { let parent_level := add(slot,1)} lt(parent_level, 33) { parent_level := add(parent_level, 1) } {
                switch eq(mod(nodeIndex, 2),0)
                case false { // We are the right child
                    mstore(x, sig)
                    mstore(add(x, 0x04), mload(add(_frontier, mul(0x20, sub(parent_level,1))))) // Load the frontier at the sibling level (left child of parent)
                    mstore(add(x,0x24), nodeValue)


                    pop(call(      // poseidon hash of concatenation of each node
                        gas(), // 5k gas
                        addr, // To addr
                        0,    // No value
                        x,    // Inputs are stored at location x
                        0x44, // Inputs are 68 bytes long
                        x,  // Store output over input (saves space)
                        0x20)) // Outputs are 32 bytes long
                    
                    nodeValue := mload(x)
                    nodeIndex := shr(1, nodeIndex) // move one row up the tree
                }
                case true { // We are the left child
                    mstore(x, sig)
                    mstore(add(x, 0x04), nodeValue)
                    mstore(add(x,0x24), 0)

                    pop(call(      // poseidon hash of concatenation of each node
                        gas(), // 5k gas
                        addr, // To addr
                        0,    // No value
                        x,    // Inputs are stored at location x
                        0x44, // Inputs are 68 bytes long
                        x,    // Store output over input (saves space)
                        0x20)) // Outputs are 32 bytes long

                    nodeValue := mload(x)
                    nodeIndex := shr(1, nodeIndex) // move one row up the tree
                }
            }

            root := nodeValue
        }

        root = bytes32(root);  

        return (root); //the root of the tree
    }

    function updateFrontier(
        bytes32[] calldata leafValues,
        bytes32[33] memory _frontier,
        uint256 _leafCountBefore
    )
        public 
        returns (bytes32[33] memory)
    {

        // check that space exists in the tree:
        require(2**32 > _leafCountBefore, "There is no space left in the tree.");
        uint256 numberOfLeaves = leafValues.length > 2**32 - _leafCountBefore 
            ? 2**32 - _leafCountBefore 
            : leafValues.length;

        address addr = address(Poseidon);
        bytes4 sig = bytes4(keccak256("poseidon(uint256,uint256)")); //Function signature

        uint256 nodeValue = 0;
        uint256 nodeIndex = 0;

        uint256 slot = 0;

        assembly {

            let x := mload(0x40)

            function getFrontierSlot(index)-> slotFrontier {
                slotFrontier := 0
                if eq(mod(index, 2),1) {
                    let exp1 := 1
                    let pow1 := 2
                    for { } eq(slotFrontier, 0) { } {
                        switch eq(mod(sub(add(index, 1), pow1), shl(1, pow1)),0)
                        case true {
                            slotFrontier:= exp1
                        }
                        case false {
                            pow1 := shl(1, pow1)
                            exp1 := add(exp1, 1)
                        }
                    }
                }
            }
          
            for { let index := 0 } lt(index, numberOfLeaves) { index := add(index, 1) } {

                nodeValue := calldataload(add(add(0x4, calldataload(0x04)), mul(0x20, add(index, 1))))
                
                slot := getFrontierSlot(add(index, _leafCountBefore)) // determine at which level we will next need to store a nodeValue

                switch eq(slot, 0)
                case true {
                    mstore(_frontier, nodeValue) // update Frontier
                } 
                case false {
                    nodeIndex := add(index, _leafCountBefore) // nodeIndex starts at the leafIndex of the new leaf
                    // Calculate the hash of the parent node of the current nodeIndex (hence starts at 1)
                    // Hash up to (and including) the frontier slot that needs to be updated (level <= slot)
                    for { let level := 1 } lt(level, add(slot,1)) { level := add(level, 1) } {
                        switch eq(mod(nodeIndex, 2),0)
                        case false { // We are the right child
                            mstore(x, sig)
                            mstore(add(x, 0x04), mload(add(_frontier, mul(0x20, sub(level,1))))) // Load the frontier at the sibling level (left child of parent)
                            mstore(add(x,0x24), nodeValue)

                            pop(call(      //This is the critical change (Pop the top stack value)
                                gas(), // 5k gas
                                addr, // To addr
                                0,    // No value
                                x,    // Inputs are stored at location x
                                0x44, // Inputs are 68 bytes long
                                x,  // Store output over input (saves space)
                                0x20)) // Outputs are 32 bytes long
                            
                            nodeValue := mload(x)
                            nodeIndex := shr(1, nodeIndex) // move one row up the tree
                        }
                        case true { // We are the left child, therefore hash with 0
                            mstore(x, sig)
                            mstore(add(x,0x04), nodeValue)
                            mstore(add(x,0x24), 0)

                            pop(call(      // poseidon hash of concatenation of each node
                                gas(), // 5k gas
                                addr, // To addr
                                0,    // No value
                                x,    // Inputs are stored at location x
                                0x44, // Inputs are 68 bytes long
                                x,    // Store output over input (saves space)
                                0x20)) // Outputs are 32 bytes long

                            nodeValue := mload(x)
                            nodeIndex := shr(1, nodeIndex) // move one row up the tree
                        }
                    }
                    mstore(add(_frontier, mul(0x20, slot)), nodeValue) // update frontier
                }
            }
        }

        return _frontier; //the root of the tree
    }
}
