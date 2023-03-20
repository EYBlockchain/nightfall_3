// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.0;

import './Ownable.sol';
import './Structures.sol';

contract Config is Ownable, Structures {
    uint256 constant CHALLENGE_PERIOD = 1 weeks;
    bytes32 constant ZERO = bytes32(0);
    uint256 constant MAX_BLOCK_SIZE = 50000;
    uint256 constant BLOCK_STRUCTURE_SLOTS = 5;

    bool RESTRICT_TOKENS; // don't turn off restrictions by default
    uint96 minimumStake;
    uint96 blockStake;
    uint256 rotateProposerBlocks;
    uint256 proposerSetCount; // number of slots to pop after shuffling slots that will build the proposer set
    uint256 sprintsInSpan; // number of sprints of a span
    uint256 maxProposers; // maximum number of proposers for the PoS

    address bootProposer;
    address bootChallenger;
    address feeL2TokenAddress;
    mapping(address => int256[2]) erc20limit;

    function initialize() public virtual override initializer {
        Ownable.initialize();
        minimumStake = 1000000 wei; // 20000000000000 wei; // 20K MATIC in mainnet
        blockStake = 1 wei; // 200000000000 wei; 200 MATIC in mainnet
        rotateProposerBlocks = 32;
        proposerSetCount = 10;
        sprintsInSpan = 10;
        maxProposers = 100;
        RESTRICT_TOKENS = true;
    }

    function restrictTokens(bool restrict) external onlyOwner {
        RESTRICT_TOKENS = restrict;
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
    function setFeeL2TokenAddress(address _feeL2TokenAddress) external onlyOwner {
        feeL2TokenAddress = _feeL2TokenAddress;
    }

    /**
     * @dev Get Matic address (fee token for proposers payment)
     */
    function getFeeL2TokenAddress() public view returns (address) {
        return feeL2TokenAddress;
    }

    // restricting tokens for deposit
    function getRestrictionDeposit(address tokenAddr) public view returns (int256) {
        return erc20limit[tokenAddr][0];
    }

    // restricting tokens for deposit
    function getRestrictionWithdraw(address tokenAddr) public view returns (int256) {
        return erc20limit[tokenAddr][1];
    }

    /**
     * @dev Set token restriction
     */
    function setRestriction(
        address tokenAddr,
        int256 depositAmount,
        int256 withdrawAmount
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
