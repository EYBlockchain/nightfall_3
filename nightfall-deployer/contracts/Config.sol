// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.0;

import './Ownable.sol';

contract Config is Ownable {
    uint256 constant REGISTRATION_BOND = 10 wei; // TODO owner can update
    uint256 constant BLOCK_STAKE = 1 wei;
    uint256 constant ROTATE_PROPOSER_BLOCKS = 4;
    uint256 constant COOLING_OFF_PERIOD = 1 weeks;
    bytes32 constant ZERO = bytes32(0);

    address bootProposer;
    address bootChallenger;

    function setBootEntities(address proposer, address challenger) external onlyOwner {
        bootProposer = proposer;
        bootChallenger = challenger;
    }

    function getBootProposer() external view returns (address) {
        return bootProposer;
    }

    function getBootChallenger() external view returns (address) {
        return bootChallenger;
    }

    modifier onlyBootProposer() {
        require(msg.sender == bootProposer, 'You are not the boot proposer');
        _;
    }

    modifier onlyBootChallenger() {
        require(msg.sender == bootChallenger, 'You are not the boot challenger');
        _;
    }
}
