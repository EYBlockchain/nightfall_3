// SPDX-License-Identifier: CC0
/*
Contract to manage the creation and managment of Proposals
*/
pragma solidity ^0.6.0;

import './Transactions.sol';

contract Proposals is Transactions {

  event RejectedProposedBlock(
    bytes32 blockHash
  );

  event AcceptedProposedBlock(
    bytes32 blockHash
  );

  address public currentProposer; // can propose a new shield state
  uint proposerStartBlock; // block where currentProposer became current
  mapping(address => LinkedProposer) public proposers;
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
    currentProposer = proposers[currentProposer].nextProposer;
  }

  /**
  * Allows a Proposer to propose a new block of state updates.
  * @param _transactionHashes - the hashes of transactions that are being
  * included in this block
  * @param _frontiers - the Timber frontier that will exist after the
  * corresponding transaction is included in the Merkle tree. This must include
  * the leaf and the root.
  */
  function proposeStateUpdatesBlock(){
  }

  function registerProposer() external payable {
    require(REGISTRATION_BOND == msg.value, 'The registration payment is incorrect');
    // splice the new proposer into the circular linked list of proposers just behind the current proposer
    ;
  }
  function deRegisterProposer(uint index) external {
    require(proposers[index] == msg.sender, 'This proposer is not registered or you are not that proposer');
    proposers[index] = address(0); // array will be a bit sparse
    require(outstandingProposals[msg.sender] <= 0, 'You cannot withdraw your bond while you still have active proposals');
    pendingWithdrawals[msg.sender] = REGISTRATION_BOND;
  }
  function withdraw() external {
    uint amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    msg.sender.transfer(amount);
  }
  function getProposers() external view returns(address[] memory) {
    return proposers;
  }
}
