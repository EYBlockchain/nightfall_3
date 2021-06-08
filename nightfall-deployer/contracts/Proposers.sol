// SPDX-License-Identifier: CC0
/*
Contract to manage the creation and managment of Proposals
*/
pragma solidity ^0.8.0;

import './Config.sol';
import './Utils.sol';
import './Structures.sol';
import './Stateful.sol';

contract Proposers is Stateful, Structures, Config {

  /**
  * Each proposer gets a chance to propose blocks for a certain time, defined
  * in Ethereum blocks.  After a certain number of blocks has passed, the
  * proposer can be rotated by calling this function. The method for choosing
  * the next proposer is simple rotation for now.
  */
  function changeCurrentProposer() external {
    require(block.number - state.getProposerStartBlock() > ROTATE_PROPOSER_BLOCKS,
    "It's too soon to rotate the proposer");
    state.setProposerStartBlock(block.number);
    LinkedAddress memory currentProposer = state.getCurrentProposer();
    state.setCurrentProposer(currentProposer.nextAddress);
    emit NewCurrentProposer(currentProposer.nextAddress);
  }


  //add the proposer to the circular linked list
  function registerProposer() external payable {
    require(REGISTRATION_BOND == msg.value, 'The registration payment is incorrect');
    LinkedAddress memory currentProposer = state.getCurrentProposer();
    // cope with this being the first proposer
    if (currentProposer.thisAddress == address(0)) {
      currentProposer = LinkedAddress(msg.sender, msg.sender, msg.sender);
      state.setProposer(msg.sender, currentProposer);
      state.setProposerStartBlock(block.number);
      emit NewCurrentProposer(currentProposer.thisAddress);
    } else {
      // else, splice the new proposer into the circular linked list of proposers just behind the current proposer
      // assume current proposer is (x,A,z) address of this proposer is B
      LinkedAddress memory proposer; // proposer: (_,_,_)
      proposer.thisAddress = msg.sender; // proposer: (_,B,_)
      proposer.nextAddress = currentProposer.thisAddress;  // proposer: (_,B,A)
      proposer.previousAddress = currentProposer.previousAddress; // proposer: (x,B,A)
      // pull global state
      LinkedAddress memory proposersPrevious = state.getProposer(currentProposer.previousAddress);
      LinkedAddress memory proposersCurrent = state.getProposer(currentProposer.thisAddress);
      // updated the pulled state
      proposersPrevious.nextAddress = proposer.thisAddress; // X: (u,v,B)
      proposersCurrent.previousAddress = proposer.thisAddress; // current: (B,A,z)
      currentProposer = proposersCurrent; // ensure sync: currentProposer: (B,A,z)
      // set global state to new values
      state.setProposer(proposersPrevious.thisAddress, proposersPrevious);
      state.setProposer(proposersCurrent.thisAddress, proposersCurrent);
      state.setProposer(msg.sender, proposer);
    }
    state.setCurrentProposer(currentProposer.thisAddress);
  }
  function deRegisterProposer() external {
    //TODO - check they have no blocks proposed
    require(state.getProposer(msg.sender).thisAddress != address(0), 'This proposer is not registered or you are not that proposer');
    state.setProposer(msg.sender, LinkedAddress(address(0), address(0), address(0))); // array will be a bit sparse
    state.addPendingWithdrawal(msg.sender, REGISTRATION_BOND);
  }
}
