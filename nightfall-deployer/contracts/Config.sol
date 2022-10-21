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

    uint96 minimumStake;
    uint96 blockStake;
    uint256 rotateProposerBlocks;
    uint256 valuePerSlot; // amount of value of a slot
    uint256 proposerSetCount; // number of slots to pop after shuffling slots that will build the proposer set
    uint256 sprintsInSpan; // number of sprints of a span
    uint256 maxProposers; // maximum number of proposers for the PoS

    address bootProposer;
    address bootChallenger;
    address maticAddress;
    mapping(address => uint256[2]) erc20limit;

    function initialize() public virtual override onlyInitializing {
        Ownable.initialize();
        minimumStake = 1000000 wei;
        blockStake = 1 wei;
        rotateProposerBlocks = 20;
        valuePerSlot = 10;
        proposerSetCount = 5;
        sprintsInSpan = 5;
        maxProposers = 100;
    }

    /**
     * @dev Set boot proposer address
     */
    function setBootProposer(address proposer) external onlyOwner {
        bootProposer = proposer;
        emit NewBootProposerSet(bootProposer);
    }

    /**
     * @dev Get boot proposer address
     */
    function getBootProposer() external view returns (address) {
        return bootProposer;
    }

    /**
     * @dev Set boot challenger address
     */
    function setBootChallenger(address challenger) external onlyOwner {
        bootChallenger = challenger;
        emit NewBootChallengerSet(bootChallenger);
    }

    /**
     * @dev Get boot challenger address
     */
    function getBootChallenger() external view returns (address) {
        return bootChallenger;
    }

    /**
     * @dev Set Matic address (fee token for proposers payment)
     */
    function setMaticAddress(address _maticAddress) external onlyOwner {
        maticAddress = _maticAddress;
    }

    /**
     * @dev Get Matic address (fee token for proposers payment)
     */
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

    /**
     * @dev Set token restriction
     */
    function setRestriction(
        address tokenAddr,
        uint256 depositAmount,
        uint256 withdrawAmount
    ) external onlyOwner {
        erc20limit[tokenAddr][0] = depositAmount;
        erc20limit[tokenAddr][1] = withdrawAmount;
    }

    /**
     * @dev Remove token restriction
     */
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
    function setMinimumStake(uint96 _minimumStake) external onlyOwner {
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
    function setBlockStake(uint96 _blockStake) external onlyOwner {
        blockStake = _blockStake;
    }

    /**
     * @dev Get block stake for a proposer
     */
    function getBlockStake() public view returns (uint96) {
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

    /**
     * @dev Set maximum number of proposers
     */
    function setMaxProposers(uint256 _maxProposers) external onlyOwner {
        maxProposers = _maxProposers;
    }

    /**
     * @dev Get maximum number of proposers
     */
    function getMaxProposers() public view returns (uint256) {
        return maxProposers;
    }
}
