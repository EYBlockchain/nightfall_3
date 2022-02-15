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
   * @dev increment stake for proposer
   */
  function stakeProposer() external payable {
    TimeLockedStake memory stake = state.getStakeAccount(msg.sender);
    stake.amount += msg.value;
    require(MINIMUM_STAKE <= stake.amount, 'Proposers: Need MINIMUM_STAKE');
    payable(address(state)).transfer(msg.value);
    state.setStakeAccount(msg.sender, stake.amount, stake.challengeLocked);
    LinkedAddress memory currentProposer = state.getCurrentProposer();

   // cope with this being the first proposer
    if (currentProposer.thisAddress == address(0)) {
      currentProposer = LinkedAddress(msg.sender, msg.sender, msg.sender, false, 0);
      state.setProposer(msg.sender, currentProposer);
      state.setProposerStartBlock(block.number);
      state.setNumProposers(1);
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
      if (proposersPrevious.thisAddress == proposersCurrent.thisAddress) { // case register second proposer
        proposersCurrent.nextAddress = proposer.thisAddress; // previous and next Address is the second proposer
      }
      currentProposer = proposersCurrent; // ensure sync: currentProposer: (B,A,z)
      // set global state to new values
      if (proposersPrevious.thisAddress != proposersCurrent.thisAddress) { // not case register second proposer
        state.setProposer(proposersPrevious.thisAddress, proposersPrevious);
      }
      state.setProposer(proposersCurrent.thisAddress, proposersCurrent);
      state.setProposer(msg.sender, proposer);
      state.setNumProposers(state.getNumProposers() + 1);
    }
    state.setCurrentProposer(currentProposer.thisAddress);
  }

  // Proposers are allowed to deregister themselves at any point (even if they are the current proposer)
  // However, their stake is only withdrawable after the CHALLENGE_PERIOD has passed. This ensures
  // they are not the proposer of any blocks that could be challenged.
  function unstakeProposer() external {
    require(state.getProposer(msg.sender).thisAddress != address(0), 'Proposers: Not a proposer');
    state.removeProposer(msg.sender);
    // The msg.sender has to wait a CHALLENGE_PERIOD from current block.timestamp
    state.updateStakeAccountTime(msg.sender, block.timestamp);
  }

  function withdrawStake() external {
    TimeLockedStake memory stake = state.getStakeAccount(msg.sender);
    require(stake.time + CHALLENGE_PERIOD < block.timestamp, 'Proposers: Too soon to withdraw the stake');
    require(state.getProposer(msg.sender).thisAddress == address(0), 'Proposers: Cannot withdraw while staking as proposer');
    // Zero out the entry in the stake escrow
    state.setStakeAccount(msg.sender, 0, 0);
    // We have waited a CHALLENGE_PERIOD so we can also withdraw the pending challengeLocked still pending
    state.addPendingWithdrawal(msg.sender, stake.amount + stake.challengeLocked);
  }
}
