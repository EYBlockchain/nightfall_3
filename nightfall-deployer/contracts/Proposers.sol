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
  mapping(address => TimeLockedBond) public pendingBondWithdrawals;

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
    payable(address(state)).transfer(REGISTRATION_BOND);
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

  // Proposers are allowed to deregister themselves at any point (even if they are the current proposer)
  // However, their bond is only withdrawable after the COOLING_OFF_PERIOD has passed. This ensures
  // they are not the proposer of any blocks that could be challenged.
  function deRegisterProposer() external {
    LinkedAddress memory proposersThis = state.getProposer(msg.sender);
    LinkedAddress memory proposersPrevious = state.getProposer(proposersThis.previousAddress);
    LinkedAddress memory proposersNext = state.getProposer(proposersThis.nextAddress);
    LinkedAddress memory proposersCurrent = state.getCurrentProposer();
    
    require(state.getProposer(msg.sender).thisAddress != address(0), 'This proposer is not registered or you are not that proposer');
    state.deleteProposer(msg.sender); // array will be a bit sparse

    // splice out the de-registered proposer from the circular list
    proposersPrevious.nextAddress = proposersNext.thisAddress;
    proposersNext.previousAddress = proposersPrevious.thisAddress;
    state.setProposer(proposersPrevious.thisAddress, proposersPrevious);
    state.setProposer(proposersNext.thisAddress, proposersNext);

    // in case the currentProposer is being de-registered, we rotate the proposer
    if(proposersThis.thisAddress == proposersCurrent.thisAddress) {
      emit NewCurrentProposer((proposersCurrent.nextAddress));
    }
    addPendingBondWithdrawal(msg.sender, REGISTRATION_BOND);
  }

   // Bonds that want to be withdrawn by deregistering proposers need to wait out the
  // cooling off period. This adds them to a special mapping that tracks time.
  // Currently, we handle multiple insertions for the same address by summing the 
  // amounts and overwritng the bond.time. We could also use a mapping => TimeLockedFund[]
  function addPendingBondWithdrawal(address addr, uint amount) private {
    TimeLockedBond memory bond = pendingBondWithdrawals[addr];
    // Increment here in case there is already value escrowed for this address
    bond.amount += amount;
    // We overwrite the time, adding new amounts will cause all locked up funds to 
    // obey the new lock time.
    bond.time = block.timestamp;
    pendingBondWithdrawals[addr] = bond;
  }

  function withdrawBond() external {
    TimeLockedBond memory bond = pendingBondWithdrawals[msg.sender];
    require(bond.time + COOLING_OFF_PERIOD < block.timestamp, 'It is too soon to withdraw your bond');
    pendingBondWithdrawals[msg.sender] = TimeLockedBond({amount: 0, time: 0});
    payable(msg.sender).transfer(bond.amount);
  }
}
