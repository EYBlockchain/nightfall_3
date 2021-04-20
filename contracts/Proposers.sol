// SPDX-License-Identifier: CC0
/*
Contract to manage the creation and managment of Proposals
*/
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import './Config.sol';
import './Utils.sol';
import './Structures.sol';

contract Proposers is Structures, Config {

  LinkedAddress currentProposer; // can propose a new shield state
  uint proposerStartBlock; // L1 block where currentProposer became current
  uint public leafCount; // number of leaves in the Merkle treeWidth
  mapping(address => uint) public pendingWithdrawals;
  mapping(bytes32 => LinkedHash) public blockHashes; //linked list of block hashes
  mapping(address => LinkedAddress) public proposers;
  bytes32 endHash; // holds the hash at the end of the linked list of block hashes, so that we can pick up the end.

  modifier onlyCurrentProposer() { // Modifier
    require(msg.sender == currentProposer.thisAddress, "Only the current proposer can call this.");
      _;
  }

  /**
  * Each proposer gets a chance to propose blocks for a certain time, defined
  * in Ethereum blocks.  After a certain number of blocks has passed, the
  * proposer can be rotated by calling this function. The method for choosing
  * the next proposer is simple rotation for now.
  */
  function changeCurrentProposer() external {
    require(block.number - proposerStartBlock > ROTATE_PROPOSER_BLOCKS,
    "It's too soon to rotate the proposer");
    proposerStartBlock = block.number;
    currentProposer = proposers[currentProposer.nextAddress];
    emit NewCurrentProposer(currentProposer.thisAddress);
  }

  /**
  * Allows a Proposer to propose a new block of state updates.
  * @param b the block being proposed.
  */
  function proposeBlock(Block memory b, Transaction[] memory t) external payable onlyCurrentProposer() {
    require(BLOCK_STAKE == msg.value, 'The stake payment is incorrect');
    // We need to check that the block has correctly stored its leaf count. This
    // is needed in case of a roll-back of a bad block, but cannot be checked by
    // a Challenge function (at least i haven't thought of a way to do it).
    require(b.leafCount == leafCount, 'The leaf count stored in the Block is not correct');
    // We need to check the blockHash on chain here, because there is no way to
    // convince a challenge function of the (in)correctness by an offchain
    // computation; the on-chain code doesn't save the pre-image of the hash so
    // it can't tell if it's been given the correct one as part of a challenge.
    require(b.blockHash == Utils.hashBlock(b), 'The block hash is incorrect');
    // Ensure that Transction[] doesn't have more txs than block because these tx hashes
    // will be added to merkle tree even though they are not in the block
    require(b.transactionHashes.length == t.length, 'The block and transaction have unequal number of transactions');
    // likewise the transaction hashes
    uint nCommitments; // number of commitments, used in NewLeaves/NewLeaf event
    for (uint i = 0; i < b.transactionHashes.length; i++) {
      // make sure the Transactions are in the Block
      require(
        b.transactionHashes[i] == Utils.hashTransaction(t[i]),
        'Transaction hash was not found'
      );
      // remember how many commitments are in the block, this is needed later
      nCommitments += t[i].commitments.length;
      }
    // All check pass so add the block to the list of blocks waiting to be permanently added to the state - we only save the hash of the block data plus the absolute minimum of metadata - it's up to the challenger, or person requesting inclusion of the block to the permanent contract state, to provide the block data.
    blockHashes[b.blockHash] = LinkedHash({
      thisHash: b.blockHash,
      previousHash: endHash,
      nextHash: ZERO,
      data: block.timestamp
    });
    blockHashes[endHash].nextHash = b.blockHash;
    endHash = b.blockHash; // point to the new end of the list of blockhashes.
    // now we need to emit all the leafValues (commitments) in this block so
    // any listening Timber instances can update their offchain DBs.
    // The first job is to assembly an array of all the leafValues in the block
    bytes32[] memory leafValues = new bytes32[](nCommitments);
    uint k;
    for (uint i = 0; i < t.length; i++) {
      for (uint j = 0; j < t[i].commitments.length; j++)
        leafValues[k++] = t[i].commitments[j];
    }
    // signal to Timber that new leaves may need to be added to the Merkle tree.
    // It's possible that these will be successfully challenged over the next
    // week, and Timber (or a Timber proxy), will need to be sure they only add
    // valid leaves to the Timber db.  This is a little challenging but the
    // alternative is to broadcast events for Timber after the challenge period
    // has elapsed.  This would take more gas because of the need to make a
    // a blockchain transaction to call a 'check week is up and then emit
    // events' function
    if (nCommitments == 1)
      emit NewLeaf(leafCount, leafValues[0], b.root);
    else if (nCommitments !=0)
      emit NewLeaves(leafCount, leafValues, b.root);
    // remember how many leaves the Merkle tree has (Timber needs this to check
    // that it hasn't missed any leaf additions)
    leafCount += nCommitments;
    emit BlockProposed(b, t, leafCount);
  }

  //add the proposer to the circular linked list
  function registerProposer() external payable {
    require(REGISTRATION_BOND == msg.value, 'The registration payment is incorrect');
    // cope with this being the first proposer
    if (currentProposer.thisAddress == address(0)) {
      currentProposer = LinkedAddress(msg.sender, msg.sender, msg.sender);
      proposers[msg.sender] = currentProposer;
      proposerStartBlock = block.number;
      emit NewCurrentProposer(currentProposer.thisAddress);
    } else {
      // else, splice the new proposer into the circular linked list of proposers just behind the current proposer
      LinkedAddress memory proposer;
      proposer.thisAddress = msg.sender;
      proposer.nextAddress = currentProposer.thisAddress;
      proposer.previousAddress = currentProposer.previousAddress;
      proposers[currentProposer.previousAddress].nextAddress = proposer.thisAddress;
      currentProposer.previousAddress = proposer.thisAddress;
      proposers[msg.sender] = proposer;
    }
  }
  function deRegisterProposer() external {
    //TODO - check they have no blocks proposed
    require(proposers[msg.sender].thisAddress != address(0), 'This proposer is not registered or you are not that proposer');
    proposers[msg.sender] = LinkedAddress(address(0), address(0), address(0)); // array will be a bit sparse
    //require(outstandingProposals[msg.sender] <= 0, 'You cannot withdraw your bond while you still have active proposals');
    pendingWithdrawals[msg.sender] = REGISTRATION_BOND;
  }
  function withdraw() external {
    uint amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    payable(msg.sender).transfer(amount);
  }

  function removeProposer(address proposer) internal {
    address previousAddress = proposers[proposer].previousAddress;
    address nextAddress = proposers[proposer].nextAddress;
    delete proposers[proposer];
    proposers[previousAddress].nextAddress = proposers[nextAddress].thisAddress;
    proposers[nextAddress].previousAddress = proposers[previousAddress].thisAddress;
    if(proposer == currentProposer.thisAddress) {
      // Cannot just call changeCurrentProposer directly due to the require time check
      proposerStartBlock = block.number;
      currentProposer = proposers[nextAddress]; 
      emit NewCurrentProposer(currentProposer.thisAddress);
    }
  }

  // Checks if a block is actually referenced in the queue of blocks waiting
  // to go into the Shield state (stops someone challenging with a non-existent
  // block).
  function isBlockReal(Block memory b) public view {
    /* require(b.blockHash == Utils.hashBlock(b), 'The block hash is incorrect'); */
    require(blockHashes[b.blockHash].thisHash == b.blockHash, 'This block does not exist');
  }

  // Checks if a block has is calculated correctly
  function isBlockHashCorrect(Block memory b) public pure {
    require(b.blockHash == Utils.hashBlock(b), 'The block hash is incorrect');
  }
}
