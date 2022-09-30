// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.0;

import './Ownable.sol';
import './Structures.sol';

contract Config is Ownable, Structures {
    uint256 constant CHALLENGE_PERIOD = 1 weeks;
    bytes32 constant ZERO = bytes32(0);
    uint256 constant TRANSACTIONS_PER_BLOCK = 32;
    uint256 constant BLOCK_STRUCTURE_SLOTS = 7;
    uint256 constant TRANSACTION_STRUCTURE_SLOTS = 24;

    uint256 minimumStake;
    uint256 blockStake;
    uint256 rotateProposerBlocks;
    uint256 valuePerSlot; // amount of value of a slot
    uint256 proposerSetCount; // number of slots to pop after shuffling slots that will build the proposer set
    uint256 sprintsInSpan; // number of sprints of a span

    address bootProposer;
    address bootChallenger;
    address maticAddress;
    mapping(address => uint256[2]) erc20limit;

    function initialize() public virtual override onlyInitializing {
        Ownable.initialize();
        minimumStake = 100 wei;
        blockStake = 1 wei;
        rotateProposerBlocks = 20;
        valuePerSlot = 10;
        proposerSetCount = 5;
        sprintsInSpan = 5;
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

    /**
     * @dev Get restricting tokens.
     * transactionType 0 for deposit and 1 for withdraw
     */
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

    /**
     * @dev Set value per slot in PoS
     */
    function setValuePerSlot(uint256 _valuePerSlot) external onlyOwner {
        valuePerSlot = _valuePerSlot;
    }

    /**
     * @dev Get value per slot in PoS
     */
    function getValuePerSlot() public view returns (uint256) {
        return valuePerSlot;
    }

    /**
     * @dev Set proposerset count in PoS
     */
    function setProposerSetCount(uint256 _proposerSetCount) external onlyOwner {
        proposerSetCount = _proposerSetCount;
    }

    /**
     * @dev Get proposerset count in PoS
     */
    function getProposerSetCount() public view returns (uint256) {
        return proposerSetCount;
    }

    /**
     * @dev Set sprints in span in PoS
     */
    function setSprintsInSpan(uint256 _sprintsInSpan) external onlyOwner {
        sprintsInSpan = _sprintsInSpan;
    }

    /**
     * @dev Get sprints in span in PoS
     */
    function getSprintsInSpan() public view returns (uint256) {
        return sprintsInSpan;
    }

    /**
     * @dev Set minimum stake for a proposer
     */
    function setMinimumStake(uint256 _minimumStake) external onlyOwner {
        minimumStake = _minimumStake;
    }

    /**
     * @dev Get minimum stake for a proposer
     */
    function getMinimumStake() public view returns (uint256) {
        return minimumStake;
    }

    /**
     * @dev Set block stake for a proposer
     */
    function setBlockStake(uint256 _blockStake) external onlyOwner {
        blockStake = _blockStake;
    }

    /**
     * @dev Get block stake for a proposer
     */
    function getBlockStake() public view returns (uint256) {
        return blockStake;
    }

    /**
     * @dev Set rotate proposer blocks for the current proposer
     */
    function setRotateProposerBlocks(uint256 _rotateProposerBlocks) external onlyOwner {
        rotateProposerBlocks = _rotateProposerBlocks;
    }

    /**
     * @dev Get rotate proposer blocks for the current proposer
     */
    function getRotateProposerBlocks() public view returns (uint256) {
        return rotateProposerBlocks;
    }
}
