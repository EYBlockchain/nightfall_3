// SPDX-License-Identifier: CC0
/*
Contract to manage the creation and managment of Proposals
*/
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import './Structures.sol';
import './Utils.sol';

contract Proposers is Structures, Utils {

  LinkedAddress currentProposer; // can propose a new shield state
  uint proposerStartBlock; // L1 block where currentProposer became current
  uint public leafCount; // number of leaves in the Merkle treeWidth


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
    // add the block to the list of blocks waiting to be permanently added to the state - we only save the hash of the block data - it's up to the challenger, or person requesting inclusion of the block to the permanent contract state, to provide the block data.
    blockHashes[b.blockHash] = LinkedHash({
      thisHash: b.blockHash,
      previousHash: endHash,
      nextHash: ZERO,
      data: block.timestamp
    });
    blockHashes[endHash].nextHash = b.blockHash;
    endHash = b.blockHash; // point to the new end of the list of blockhashes.
    // We need to check the blockHash on chain here, because there is no way to
    // convince a challenge function of the (in)correctness by an offchain
    // computation; the on-chain code doesn't save the pre-image of the hash so
    // it can't tell if it's been given the correct one as part of a challenge.
    require(b.blockHash == hashBlock(b), 'The block hash is incorrect');
    // likewise the transaction hashes
    uint nCommitments; // number of commitments, used in NewLeaves/NewLeaf event
    for (uint i = 0; i < b.transactionHashes.length; i++) {
      // make sure the Transactions are in the Block
      require(
        b.transactionHashes[i] == hashTransaction(t[i]),
        'Transaction hash was not found'
      );
      // remember how many commitments are in the block, this is needed later
      nCommitments += t[i].commitments.length;
      }
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
    emit BlockProposed(b, t);
  }

  //add the proposer to the circular linked list
  function registerProposer() external payable {
    require(REGISTRATION_BOND == msg.value, 'The registration payment is incorrect');
    // cope with this being the first proposer
    if (currentProposer.thisAddress == address(0)) {
      currentProposer = LinkedAddress(msg.sender, msg.sender, msg.sender);
      proposers[msg.sender] = currentProposer;
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
    msg.sender.transfer(amount);
  }
}
