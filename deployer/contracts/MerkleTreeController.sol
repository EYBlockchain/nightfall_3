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
    function _insertLeaf(bytes32 leafValue) external onlyOwner {

        bytes32 root = insertLeaf(leafValue); // recalculate the root of the tree

        // emit newLeaf(leafCount, leafValue, root); // this event is what the merkle-tree microservice's filter will listen for.
    }

    /**
    Append leaves to the tree
    */
    function _insertLeaves(bytes32[] calldata leafValues) external onlyOwner {

        bytes32 root = insertLeaves(leafValues); // recalculate the root of the tree

        // emit newLeaf(leafCount, leafValue, root); // this event is what the merkle-tree microservice's filter will listen for.
    }
}
