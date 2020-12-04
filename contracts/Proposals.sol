// SPDX-License-Identifier: CC0
/*
Contract to manage the creation and managment of Proposals
*/
pragma solidity ^0.6.0;

import './Transactions.sol';

contract Proposals is Transactions {

  event StateUpdateBlockProposed(
    bytes32[] transactionHashes,
    bytes32[33][] frontiers
  );

  event RejectedProposedStateUpdate(
    uint proposalNonce
  );

  event AcceptedProposedStateUpdate(
    uint proposalNonce
  );

  struct ProposedStateUpdate {
    address proposer;
    uint blockTime;
    uint blockEnd;
    bytes32 transactionHash;
    bytes32[33] frontier;
  }

  address public proposer; // can propose a new shield state
  mapping(address => bool) public proposers;
  uint public proposalNonce;
  mapping(uint => ProposedStateUpdate) public proposedStateUpdates;
  mapping(address => uint) public pendingWithdrawals;
  uint constant REGISTRATION_FEE = 1 ether; // TODO owner can update

  modifier onlyProposer() { // Modifier
    require(proposers[msg.sender], "Only proposers can call this.");
      _;
  }

  /**
  * Allows a Proposer to propose a new block of state updates.
  * @param _transactionHashes - the hashes of transactions that are being
  * included in this block
  * @param _frontiers - the Timber frontier that will exist after the
  * corresponding transaction is included in the Merkle tree. This must include
  * the leaf and the root.
  */
  function proposeStateUpdatesBlock(
    bytes32[] calldata _transactionHashes,
    bytes32[33][] calldata _frontiers
  ) external onlyProposer {
    // data validity checks
    require(_frontiers.length == _transactionHashes.length);
    //record in each proposal in the block, where the block ends.  If we get a
    // successful challenge, we use this to blow away the remaining proposals
    // in the block
    uint blockEnd = proposalNonce + _transactionHashes.length ;
    // check all the transactions exist and delete them, because they've now
    // been proposed and we don't want another Proposer picking them up
    // in principle, we could leave this to a challenge but it's quite hard to
    // check without a synchonised database of transaction states.
    for (uint i = 0; i < _transactionHashes.length; i++) {
      require(transactionHashes[_transactionHashes[i]], 'Non-existant transactionHash proposed');
      transactionHashes[_transactionHashes[i]] = false;
      ProposedStateUpdate memory p = ProposedStateUpdate({
        proposer: msg.sender,
        blockTime: now,
        blockEnd: blockEnd,
        transactionHash: _transactionHashes[i],
        frontier: _frontiers[i]
      });
      proposedStateUpdates[proposalNonce++] = p;
    }
    emit StateUpdateBlockProposed(_transactionHashes, _frontiers);
  }

  function registerProposer() external payable {
    require(REGISTRATION_FEE == msg.value, 'The registration payment is incorrect');
    proposers[msg.sender] = true;
  }
  function deregisterProposer() external {
    require(proposers[msg.sender], 'This proposer is not registered');
    pendingWithdrawals[msg.sender] = REGISTRATION_FEE;
  }
  function withdraw() external {
    uint amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    msg.sender.transfer(amount);
  }
}
