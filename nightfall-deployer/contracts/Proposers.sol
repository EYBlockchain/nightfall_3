// SPDX-License-Identifier: CC0
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
     @dev register proposer with stake  
     */
    function registerProposer(string calldata url) external payable nonReentrant {
        TimeLockedStake memory stake = state.getStakeAccount(msg.sender);
        stake.amount += msg.value;
        require(minimumStake <= stake.amount, 'Proposers: Need minimumStake');
        require(
            state.getProposer(msg.sender).thisAddress == address(0),
            'Proposers: This proposer is already registered'
        );

        // send the stake to the state contract
        (bool success, ) = payable(address(state)).call{value: minimumStake}('');
        require(success, 'Proposers: Transfer failed.');
        state.setStakeAccount(msg.sender, stake.amount, stake.challengeLocked);

        LinkedAddress memory currentProposer = state.getCurrentProposer();
        // cope with this being the first proposer
        if (currentProposer.thisAddress == address(0)) {
            currentProposer = LinkedAddress(msg.sender, msg.sender, msg.sender, url, false, 0);
            state.setProposer(msg.sender, currentProposer);
            state.setProposerStartBlock(block.number);
            state.setNumProposers(1);
            emit NewCurrentProposer(currentProposer.thisAddress);
        } else {
            // only if it's not a proposer yet
            if (state.getProposer(msg.sender).thisAddress == address(0)) {
                // else, splice the new proposer into the circular linked list of proposers just behind the current proposer
                // assume current proposer is (x,A,z) address of this proposer is B
                LinkedAddress memory proposer; // proposer: (_,_,_)
                proposer.thisAddress = msg.sender; // proposer: (_,B,_)
                proposer.nextAddress = currentProposer.thisAddress; // proposer: (_,B,A)
                proposer.previousAddress = currentProposer.previousAddress; // proposer: (x,B,A)
                // pull global state
                LinkedAddress memory proposersPrevious = state.getProposer(
                    currentProposer.previousAddress
                );
                LinkedAddress memory proposersCurrent = state.getProposer(
                    currentProposer.thisAddress
                );
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
                state.setNumProposers(state.getNumProposers() + 1);
            }
        }
        state.setCurrentProposer(currentProposer.thisAddress);
    }

    // Proposers are allowed to deregister themselves at any point (even if they are the current proposer)
    // However, their stake is only withdrawable after the CHALLENGE_PERIOD has passed. This ensures
    // they are not the proposer of any blocks that could be challenged.
    function deRegisterProposer() external nonReentrant {
        require(
            state.getProposer(msg.sender).thisAddress != address(0),
            'Proposers: Not a proposer'
        );
        state.removeProposer(msg.sender);
        // The msg.sender has to wait a CHALLENGE_PERIOD from current block.timestamp
        state.updateStakeAccountTime(msg.sender, block.timestamp);
    }

    function withdrawStake() external {
        TimeLockedStake memory stake = state.getStakeAccount(msg.sender);
        require(
            stake.time + CHALLENGE_PERIOD < block.timestamp,
            'Proposers: Too soon to withdraw the stake'
        );
        require(
            state.getProposer(msg.sender).thisAddress == address(0),
            'Proposers: Cannot withdraw while staking as proposer'
        );
        // Zero out the entry in the stake escrow
        state.setStakeAccount(msg.sender, 0, 0);
        // We have waited a CHALLENGE_PERIOD so we can also withdraw the pending challengeLocked still pending
        state.addPendingWithdrawal(msg.sender, stake.amount + stake.challengeLocked, 0);
    }

    // Proposers can change REST API URL or increment stake
    function updateProposer(string calldata url) external payable nonReentrant {
        require(
            state.getProposer(msg.sender).thisAddress != address(0),
            'Proposers: This proposer is not registered or you are not that proposer'
        );
        state.updateProposer(msg.sender, url);
        if (msg.value > 0) {
            TimeLockedStake memory stake = state.getStakeAccount(msg.sender);
            stake.amount += msg.value;

            // send the stake to the state contract
            (bool success, ) = payable(address(state)).call{value: minimumStake}('');
            require(success, 'Proposers: Transfer failed.');
            state.setStakeAccount(msg.sender, stake.amount, stake.challengeLocked);
        }
    }
}
