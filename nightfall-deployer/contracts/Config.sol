// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.0;

import './Ownable.sol';

contract Config is Ownable {
    uint256 constant REGISTRATION_BOND = 10 wei; // TODO owner can update
    uint256 constant BLOCK_STAKE = 1 wei;
    uint256 constant ROTATE_PROPOSER_BLOCKS = 4;
    uint256 constant COOLING_OFF_PERIOD = 1 weeks;
    bytes32 constant ZERO = bytes32(0);
    uint256 constant TXHASH_TREE_HEIGHT = 5;
    uint256 constant TRANSACTIONS_BATCH_SIZE = 2; // TODO Change this from 2 to an appropriate value to control stack too deep error

    address bootProposer;
    address bootChallenger;
    mapping(address => uint256) erc20limit;

    function initialize() public virtual override initializer {
        Ownable.initialize();
    }

    // restricting proposers
    modifier onlyBootProposer() {
        require(msg.sender == bootProposer, 'You are not the boot proposer');
        _;
    }

    function setBootProposer(address proposer) external onlyOwner {
        bootProposer = proposer;
    }

    function getBootProposer() external view returns (address) {
        return bootProposer;
    }

    // restricting challengers
    modifier onlyBootChallenger() {
        require(msg.sender == bootChallenger, 'You are not the boot challenger');
        _;
    }

    function setBootChallenger(address challenger) external onlyOwner {
        bootChallenger = challenger;
    }

    function getBootChallenger() external view returns (address) {
        return bootChallenger;
    }

    // restricting tokens
    function getRestriction(address tokenAddr) public view returns (uint256) {
        return erc20limit[tokenAddr];
    }

    function setRestriction(address tokenAddr, uint256 amount) external onlyOwner {
        erc20limit[tokenAddr] = amount;
    }

    function removeRestriction(address tokenAddr) external onlyOwner {
        delete erc20limit[tokenAddr];
    }
}
