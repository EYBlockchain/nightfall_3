// SPDX-License-Identifier: CC0
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
/*
Contract to manage the creation and managment of Proposals
*/
pragma solidity ^0.8.0;

import './Config.sol';
import './Utils.sol';
import './Stateful.sol';

contract Proposers is Stateful, Config, ReentrancyGuardUpgradeable {
    function initialize() public override(Stateful, Config) initializer {
        Stateful.initialize();
        Config.initialize();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
    }

    /**
     * Each proposer gets a chance to propose blocks for a certain time, defined
     * in Ethereum blocks.  After a certain number of blocks has passed, the
     * proposer can be rotated by calling this function. The method for choosing
     * the next proposer is simple rotation for now.
     */
    function changeCurrentProposer() external {
        require(
            block.number - state.getProposerStartBlock() > ROTATE_PROPOSER_BLOCKS,
            "It's too soon to rotate the proposer"
        );
        state.setProposerStartBlock(block.number);
        LinkedAddress memory currentProposer = state.getCurrentProposer();
        state.setCurrentProposer(currentProposer.nextAddress);
        emit NewCurrentProposer(currentProposer.nextAddress);
    }

    //add the proposer to the circular linked list
    function registerProposer(string memory url) external payable nonReentrant onlyBootProposer {
        require(REGISTRATION_BOND <= msg.value, 'The registration payment is incorrect');
        require(
            state.getProposer(msg.sender).thisAddress == address(0),
            'This proposer is already registered'
        );
        // send the bond to the state contract
        (bool success, ) = payable(address(state)).call{value: REGISTRATION_BOND}('');
        require(success, 'Transfer failed.');
        state.setBondAccount(msg.sender, REGISTRATION_BOND);
        LinkedAddress memory currentProposer = state.getCurrentProposer();
        // cope with this being the first proposer
        if (currentProposer.thisAddress == address(0)) {
            currentProposer = LinkedAddress(msg.sender, msg.sender, msg.sender, url);
            state.setProposer(msg.sender, currentProposer);
            state.setProposerStartBlock(block.number);
            emit NewCurrentProposer(currentProposer.thisAddress);
        } else {
            // else, splice the new proposer into the circular linked list of proposers just behind the current proposer
            // assume current proposer is (x,A,z) address of this proposer is B
            LinkedAddress memory proposer; // proposer: (_,_,_)
            proposer.thisAddress = msg.sender; // proposer: (_,B,_)
            proposer.nextAddress = currentProposer.thisAddress; // proposer: (_,B,A)
            proposer.previousAddress = currentProposer.previousAddress; // proposer: (x,B,A)
            proposer.url = url;
            // pull global state
            LinkedAddress memory proposersPrevious =
                state.getProposer(currentProposer.previousAddress);
            LinkedAddress memory proposersCurrent = state.getProposer(currentProposer.thisAddress);
            // updated the pulled state
            proposersPrevious.nextAddress = proposer.thisAddress; // X: (u,v,B)
            proposersCurrent.previousAddress = proposer.thisAddress; // current: (B,A,z)
            if (proposersPrevious.thisAddress == proposersCurrent.thisAddress) {
                // case register second proposer
                proposersCurrent.nextAddress = proposer.thisAddress; // previous and next Address is the second proposer
            }
            currentProposer = proposersCurrent; // ensure sync: currentProposer: (B,A,z)
            // set global state to new values
            if (proposersPrevious.thisAddress != proposersCurrent.thisAddress) {
                // not case register second proposer
                state.setProposer(proposersPrevious.thisAddress, proposersPrevious);
            }
            state.setProposer(proposersCurrent.thisAddress, proposersCurrent);
            state.setProposer(msg.sender, proposer);
        }
        state.setCurrentProposer(currentProposer.thisAddress);
    }

    // Proposers are allowed to deregister themselves at any point (even if they are the current proposer)
    // However, their bond is only withdrawable after the COOLING_OFF_PERIOD has passed. This ensures
    // they are not the proposer of any blocks that could be challenged.
    function deRegisterProposer() external {
        require(
            state.getProposer(msg.sender).thisAddress != address(0),
            'This proposer is not registered or you are not that proposer'
        );
        state.removeProposer(msg.sender);
        // The msg.sender has to wait a COOLING_OFF_PERIOD from current block.timestamp
        state.updateBondAccountTime(msg.sender, block.timestamp);
    }

    function withdrawBond() external {
        TimeLockedBond memory bond = state.getBondAccount(msg.sender);
        require(
            bond.time + COOLING_OFF_PERIOD < block.timestamp,
            'It is too soon to withdraw your bond'
        );
        require(
            state.getProposer(msg.sender).thisAddress == address(0),
            'Cannot withdraw bond while a registered proposer'
        );
        // Zero out the entry in the bond escrow
        state.setBondAccount(msg.sender, 0);
        state.addPendingWithdrawal(msg.sender, bond.amount, 0);
    }

    // Proposers can change REST API URL
    function updateProposer(string memory url) external {
        require(
            state.getProposer(msg.sender).thisAddress != address(0),
            'This proposer is not registered or you are not that proposer'
        );
        state.updateProposer(msg.sender, url);
    }
}
