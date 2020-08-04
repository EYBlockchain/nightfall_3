/**
Contract to manage permissions to update the leaves of the imported MerkleTree contract (which is the base contract which handles tree inserts and updates).

@Author iAmMichaelConnor
*/
pragma solidity ^0.5.8;

import "./MerkleTreeSHA.sol";

contract MerkleTreeControllerSHA is MerkleTreeSHA {

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
    @notice Constructor for the MerkleTreeController contract.
    */
    constructor() public {
        owner = msg.sender;
    }

    /**
    @notice Append a leaf to the tree
    @param leafValue - the value of the leaf being inserted.
    */
    function _insertLeaf(bytes32 leafValue) external onlyOwner {

        bytes32 root = insertLeaf(leafValue); // recalculate the root of the tree

        // roots[root] = root;

        latestRoot = root;
    }

    /**
    @notice Append leaves to the tree
    @param leafValues - the values of the leaves being inserted.
    */
    function _insertLeaves(bytes32[] calldata leafValues) external onlyOwner {

        bytes32 root = insertLeaves(leafValues); // recalculate the root of the tree

        // roots[root] = root;

        latestRoot = root;
    }
}
