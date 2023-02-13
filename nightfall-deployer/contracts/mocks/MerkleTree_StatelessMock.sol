pragma solidity ^0.8.0;

import '../MerkleTree_Stateless.sol';

contract MerkleTree_StatelessMock {
    function calculateRoot(
        bytes32[33] memory _frontier,
        uint256 leafCount // it's not the last leaf count it's actually the leaf count.
    ) public returns (bytes32 root) {
        root = MerkleTree_Stateless.calculateRoot(_frontier, leafCount);
        return root;
    }

    function updateFrontier(
        bytes32[] calldata leafValues,
        bytes32[33] memory _frontier,
        uint256 _leafCountBefore
    ) public returns (bytes32[33] memory frontier) {
        frontier = MerkleTree_Stateless.updateFrontier(leafValues, _frontier, _leafCountBefore);
        return frontier;
    }
}