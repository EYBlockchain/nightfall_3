// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.0;

import './Ownable.sol';
import './Structures.sol';

contract Config is Ownable, Structures {
    uint256 constant MINIMUM_STAKE = 100 wei; // TODO owner can update
    uint256 constant BLOCK_STAKE = 1 wei;
    uint256 constant ROTATE_PROPOSER_BLOCKS = 20;
    uint256 constant CHALLENGE_PERIOD = 1 weeks;
    bytes32 constant ZERO = bytes32(0);
    uint256 constant TRANSACTIONS_PER_BLOCK = 32;
    uint256 constant BLOCK_STRUCTURE_SLOTS = 7;
    uint256 constant TRANSACTION_STRUCTURE_SLOTS = 24;
    uint256 constant VALUE_PER_SLOT = 10; // amount of value of a slot
    uint256 constant PROPOSER_SET_COUNT = 5; // number of slots to pop after shuffling slots that will build the proposer set
    uint256 constant SPRINTS_IN_SPAN = 5; // number of sprints of a span

    address bootProposer;
    address bootChallenger;
    address maticAddress;
    mapping(address => uint256[2]) erc20limit;

    function initialize() public virtual override onlyInitializing {
        Ownable.initialize();
    }

    // restricting proposers
    modifier onlyBootProposer() {
        require(msg.sender == bootProposer, 'You are not the boot proposer');
        _;
    }

    function setBootProposer(address proposer) external onlyOwner {
        bootProposer = proposer;
        emit NewBootProposerSet(bootProposer);
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
        emit NewBootChallengerSet(bootChallenger);
    }

    function getBootChallenger() external view returns (address) {
        return bootChallenger;
    }

    //Set payments address
    function setMaticAddress(address _maticAddress) external onlyOwner {
        maticAddress = _maticAddress;
    }

    function getMaticAddress() public view returns (address) {
        return maticAddress;
    }

    // restricting tokens
    // 0 for deposit and 1 for withdraw
    function getRestriction(address tokenAddr, uint256 transactionType)
        public
        view
        returns (uint256)
    {
        return erc20limit[tokenAddr][transactionType];
    }

    function setRestriction(
        address tokenAddr,
        uint256 depositAmount,
        uint256 withdrawAmount
    ) external onlyOwner {
        erc20limit[tokenAddr][0] = depositAmount;
        erc20limit[tokenAddr][1] = withdrawAmount;
    }

    function removeRestriction(address tokenAddr) external onlyOwner {
        delete erc20limit[tokenAddr][0];
        delete erc20limit[tokenAddr][1];
    }
}
