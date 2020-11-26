// SPDX-License-Identifier: CC0
/**
Contract to support optimistic verification of proofs.  This doesn't (yet) do
a rollup.
*/
pragma solidity ^0.6.0;

import './Shield.sol';

contract Optimist is Shield {

  uint public nonce; // keeps track of the transaction requests
  address public proposer; // can propose a new shield state
  address public validator; // can validate a proposal
  uint transactionFee = 1;

  event NewDeposit(
    uint _nonce,
    bytes32 _publicInputHash,
    bytes32 ercAddress, // Take in as bytes32 for consistent hashing
    bytes32 _tokenId,
    bytes32 _value,
    bytes32 _commitment,
    uint256[] _proof
  );
  event Proposal(uint _startNonce, uint _endNonce, bytes32 _latestRoot, bytes32[] _commitments, bytes32[] _nullifiers);


  constructor(address _verifier) Shield(_verifier) public {
  }

  modifier onlyProposer() { // Modifier
    require(msg.sender == proposer, "Only proposer can call this.");
      _;
  }

  modifier onlyValidator() { // Modifier
    require(msg.sender == validator, "Only validator can call this.");
      _;
  }

  function optimisticDeposit(
      bytes32 _publicInputHash,
      bytes32 ercAddress, // Take in as bytes32 for consistent hashing
      bytes32 _tokenId,
      bytes32 _value,
      bytes32 _commitment,
      uint256[] calldata _proof
    ) public payable {
    // gas measurement:
    uint256 gasCheckpoint = gasleft();

    emit NewDeposit(
      nonce,
      _publicInputHash,
      ercAddress,
      _tokenId,
      _value,
      _commitment,
      _proof
    );
    nonce++;
    uint256 gasUsedByDeposit = gasCheckpoint - gasleft();
    emit GasUsed(gasUsedByDeposit, gasUsedByDeposit);
  }

  function propose(uint _startNonce, uint _endNonce, bytes32 _latestRoot, bytes32[] calldata _commitments, bytes32[] calldata _nullifiers) external {
    emit Proposal(_startNonce, _endNonce, _latestRoot, _commitments, _nullifiers);
  }

  // Update the state for a double transfer
  function updateState(
    bytes32 _latestRoot,
    bytes32 [] calldata _newCommitmentHashes,
    bytes32[] calldata _nullifierHashes
  ) private {
    latestRoot = _latestRoot;
    roots[latestRoot] = true;
    for (uint i = 0; i < _nullifierHashes.length; i++)
      usedNullifiers[_nullifierHashes[i]] = true;
    emit NewLeaves(leafCount, _newCommitmentHashes, _latestRoot);
    leafCount += _newCommitmentHashes.length;
  }
  // Update the state for a single transfer
  function updateState(
    bytes32 _latestRoot,
    bytes32 _newCommitmentHash,
    bytes32 _nullifierHash
  ) private {
    latestRoot = _latestRoot;
    roots[latestRoot] = true;
    usedNullifiers[_nullifierHash] = true;
    emit NewLeaf(leafCount, _newCommitmentHash, _latestRoot);
    leafCount++;
  }
  // Update the state for a deposit
  function updateState(
    bytes32 _latestRoot,
    bytes32 _newCommitmentHash
  ) private {
    latestRoot = _latestRoot;
    roots[latestRoot] = true;
    emit NewLeaf(leafCount, _newCommitmentHash, _latestRoot);
    leafCount++;
  }
  // Update the state for a withdraw
  function updateState( bytes32 _nullifierHash ) private {
    usedNullifiers[_nullifierHash] = true;
  }
}
