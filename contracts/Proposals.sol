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
    uint fee;
    bytes32 transactionHash;
    bytes32[33] frontier;
  }

  address public currentProposer; // can propose a new shield state
  uint public currentProposerIndex; // keeps track of which proposer is current
  uint proposerStartBlock; // block where currentProposer became current
  address[] public proposers;
  uint public proposalNonce;
  mapping(uint => ProposedStateUpdate) public proposedStateUpdates;
  mapping(address => uint) public pendingWithdrawals;
  uint constant REGISTRATION_BOND = 10 ether; // TODO owner can update
  uint constant ROTATE_PROPOSER_BLOCKS = 4;

  modifier onlyCurrentProposer() { // Modifier
    require(msg.sender == currentProposer, "Only the current proposer can call this.");
      _;
  }

  /**
  * Each proposer gets a chance to propose blocks for a certain time, defined
  * in Ethereum blocks.  After a certain number of blocks has passed, the
  * proposer can be rotated by calling this function. The method for choosing
  * the next proposer is simple rotation for now.
  */
  function changeCurrentProposer() external {
    require(block.number - proposerStartBlock > ROTATE_PROPOSER_BLOCKS,
    "It's too soon to rotate the proposer");
    proposerStartBlock = block.number;
    currentProposer = proposers[currentProposerIndex++];
    if (currentProposerIndex == proposers.length) currentProposerIndex = 0;
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
  ) external onlyCurrentProposer {
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
      require(transactionHashes[_transactionHashes[i]] > 0, 'Non-existant transactionHash proposed');
      ProposedStateUpdate memory p = ProposedStateUpdate({
        proposer: msg.sender,
        blockTime: now,
        blockEnd: blockEnd,
        fee: transactionHashes[_transactionHashes[i]],
        transactionHash: _transactionHashes[i],
        frontier: _frontiers[i]
      });
      transactionHashes[_transactionHashes[i]] = 0;
      proposedStateUpdates[proposalNonce++] = p;
    }
    emit StateUpdateBlockProposed(_transactionHashes, _frontiers);
  }

  function registerProposer() external payable {
    require(REGISTRATION_BOND == msg.value, 'The registration payment is incorrect');
    proposers.push(msg.sender);
  }
  function deregisterProposer(uint index) external {
    require(proposers[index] == msg.sender, 'This proposer is not registered or you are not that proposer');
    proposers[index] = address(0); // array will be a bit sparse
    pendingWithdrawals[msg.sender] = REGISTRATION_BOND;
  }
  function withdraw() external {
    uint amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    msg.sender.transfer(amount);
  }
}
