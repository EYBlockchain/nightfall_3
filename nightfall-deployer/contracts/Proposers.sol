// SPDX-License-Identifier: CC0
/*
Contract to manage the creation and managment of Proposals
*/
pragma solidity ^0.8.0;

import './Config.sol';
import './Utils.sol';
import './Structures.sol';

contract Proposers is Structures, Config {

  LinkedAddress public currentProposer; // can propose a new shield state
  uint proposerStartBlock; // L1 block where currentProposer became current
  mapping(address => uint) public pendingWithdrawals;
  // mapping(bytes32 => LinkedHash) public blockHashes; //linked list of block hashes
  mapping(address => LinkedAddress) public proposers;

  function getCurrentProposer() public view returns(address) {
    return currentProposer.thisAddress;
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
    currentProposer = proposers[currentProposer.nextAddress];
    emit NewCurrentProposer(currentProposer.thisAddress);
  }


  //add the proposer to the circular linked list
  function registerProposer() external payable {
    require(REGISTRATION_BOND == msg.value, 'The registration payment is incorrect');
    // cope with this being the first proposer
    if (currentProposer.thisAddress == address(0)) {
      currentProposer = LinkedAddress(msg.sender, msg.sender, msg.sender);
      proposers[msg.sender] = currentProposer;
      proposerStartBlock = block.number;
      emit NewCurrentProposer(currentProposer.thisAddress);
    } else {
      // else, splice the new proposer into the circular linked list of proposers just behind the current proposer
      // assume current proposer is (x,A,z) address of this proposer is B
      LinkedAddress memory proposer; // proposer: (_,_,_)
      proposer.thisAddress = msg.sender; // proposer: (_,B,_)
      proposer.nextAddress = currentProposer.thisAddress;  // proposer: (_,B,A)
      proposer.previousAddress = currentProposer.previousAddress; // proposer: (x,B,A)
      proposers[currentProposer.previousAddress].nextAddress = proposer.thisAddress; // X: (u,v,B)
      proposers[currentProposer.thisAddress].previousAddress = proposer.thisAddress; // current: (B,A,z)
      currentProposer = proposers[currentProposer.thisAddress]; // ensure sync: currentProposer: (B,A,z)
      proposers[msg.sender] = proposer;
    }
  }
  function deRegisterProposer() external {
    //TODO - check they have no blocks proposed
    require(proposers[msg.sender].thisAddress != address(0), 'This proposer is not registered or you are not that proposer');
    proposers[msg.sender] = LinkedAddress(address(0), address(0), address(0)); // array will be a bit sparse
    //require(outstandingProposals[msg.sender] <= 0, 'You cannot withdraw your bond while you still have active proposals');
    pendingWithdrawals[msg.sender] = REGISTRATION_BOND;
  }

  function addToPendingWithdrawals(address addr, uint amount) public {
    pendingWithdrawals[addr] += amount;
  }

  function withdraw() external {
    uint amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    payable(msg.sender).transfer(amount);
  }

  function removeProposer(address proposer) public {
    address previousAddress = proposers[proposer].previousAddress;
    address nextAddress = proposers[proposer].nextAddress;
    delete proposers[proposer];
    proposers[previousAddress].nextAddress = proposers[nextAddress].thisAddress;
    proposers[nextAddress].previousAddress = proposers[previousAddress].thisAddress;
    if(proposer == currentProposer.thisAddress) {
      // Cannot just call changeCurrentProposer directly due to the require time check
      proposerStartBlock = block.number;
      currentProposer = proposers[nextAddress];
      emit NewCurrentProposer(currentProposer.thisAddress);
    }
  }
}
