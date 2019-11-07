/**
Contract to enable the management of hidden non fungible toke transactions.
@Author Westlad, Chaitanya-Konda, iAmMichaelConnor
*/
pragma solidity ^0.5.8;

import "./MerkleTree.sol";

contract MerkleTreeController is MerkleTree {

    address public owner; // We'll demonstrate simple 'permissioning' to update leaves by only allowing the owner to update leaves.

    mapping(bytes32 => bytes32) public roots; // Example of a way to hold every root that's been calculated by this contract. This isn't actually used by this simple example-contract.

    bytes32 public latestRoot; // Example of a way to hold the latest root so that users can retrieve it. This isn't actually used by this simple example-contract.

    /**
    We'll demonstrate simple 'permissioning' to update leaves by only allowing the owner to update leaves.
    @dev Throws if called by any account other than the owner.
    */
    modifier onlyOwner() {
        require(msg.sender == owner, "You are not authorised to invoke this function");
        _;
    }

    /**
    Constructor for the MerkleTreeController contract. We also need to specify the arguments for the Base contract's (MerkleTree.sol's) constructor. We do this through a "modifier" of this 'derived' contract's constructor (hence the unusual 'MerkleTree' "modifier" directly below):
    */
    constructor(uint _treeHeight) MerkleTree(_treeHeight) public {
        owner = msg.sender;
    }

    /**
    Append a leaf to the tree
    */
    function insertLeaf(bytes32 leafValue) external onlyOwner {

        ++leafCount;

        bytes32 root = updatePathToRoot(leafCount, leafValue); // recalculate the root of the tree as it's now different.
        roots[root] = root; // and save the new root to the list of roots.
        latestRoot = root; // update the current root.

        emit newLeaf(leafCount, leafValue); // this event is what the merkle-tree microservice's filter will listen for.
    }
}
