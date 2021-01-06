// SPDX-License-Identifier: CC0-1.0

/**
Contract to enable someone to submit a ZKP transaction for processing.
It is possible we will move this off-chain in the future as blockchain
functionality is not really required - it's just a data availability aid.
@Author Westlad
*/

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import './Structures.sol';
import './Utils.sol';

contract Shield is Structures, Utils {
  // The two mappings and leaf count below comprise the state of the Shield contract
  mapping(bytes32 => bool) public spentNullifiers; //list of used Nullifiers
  mapping(bytes32 => bool) public historicRoots; //list of historic roots
  uint leafCount; // number of leaves in the Merkle treeWidth

  /**
  We don't need to do the checks herein because the Proposer should do them.
  We don't really need this function at all because we could just send the
  transaction to a proposer.  Thus, some or all of this functionality may be
  removed in future to save Gas.
  */
  function submitTransaction(Transaction memory t) external payable {
    //check the transaction hash
    require (t.transactionHash == hashTransaction(t), 'The transaction hash is not correct');
    //check they've paid correctly
    require (t.fee == msg.value, 'The amount paid was not the same as the amount specified in the transaction');
    // TODO take payment for a Deposit - can't do it here because no guarantee
    // transaction will proceed (we could refund later if it doesn't of course).
    // if this is a deposit transaction, we should take payment now
    // let everyone know what you did
    emit TransactionSubmitted(t);
    // if this is a deposit transaction, take payment now (TODO: is there a
    // better way? This feels expensive).
    if (t.transactionType == TransactionTypes.DEPOSIT) payIn(t);
  }

  /**
  This function is called to add a block to the permanent record of state in
  the Shield contract.  Who calls it is currently a point of debate (but anyone
  _can_)
  */
  function updateShieldState(Block memory b, Transaction[] memory t) external {
    // check this block is a real one, in the queue, not something made up.
    isBlockReal(b);
    // check that this is the block we should be adding. The next block to add
    // is unique in that its previousHash is zero.
    require(blockHashes[b.blockHash].previousHash == ZERO, 'This is not the next block to add');
    // check that its cooling-off period is over
    require(b.blockTime + COOLING_OFF_PERIOD < block.timestamp, 'It is too soon to add this block');
    // add the nullifiers state to the Shield contract.
    uint nCommitments; // number of commitments, used later
    for (uint i = 0; i < b.transactionHashes.length; i++) {
      // make sure the Transactions are in the Block
      require(
        b.transactionHashes[i] == hashTransaction(t[i]),
        'Transaction hash was not found'
      );
      // remember how many commitments are in the block, this is needed later
      nCommitments += t[i].commitments.length;
      // store the nullifiers from each transaction in turn
      for (uint j = 0; j < t[i].nullifiers.length; j++) {
        spentNullifiers[t[i].nullifiers[j]] = true;
      }
      // pay out any withdraws
      if (t[i].transactionType == TransactionTypes.WITHDRAW) payOut(t[i]);
    }
    // add the commitment root to the Shield state
    historicRoots[b.root] = true;
    // now we need to emit all the leafValues (commitments) in this block so
    // any listening Timber instances can update their offchain DBs.
    // The first job is to assembly an array of all the leafValues in the block
    bytes32[] memory leafValues = new bytes32[](nCommitments);
    uint k;
    for (uint i = 0; i < t.length; i++) {
      for (uint j = 0; j < t[i].commitments.length; j++)
        leafValues[k++] = t[i].commitments[j];
    }
    // Signal to Timber listeners, if we have any commitments to add
    if (nCommitments == 1)
      emit NewLeaf(leafCount, leafValues[0], b.root);
    else if (nCommitments !=0)
      emit NewLeaves(leafCount, leafValues, b.root);
    // remember how many leaves the Merkle tree has (Timber needs this to check
    // that it hasn't missed any leaf additions)
    leafCount += nCommitments;
    // finally, update the queue of blockHashes so the penultimate block
    // becomes the new ultimate block, ready for addition to the Shield state in
    // due course
    blockHashes[blockHashes[b.blockHash].nextHash].previousHash = ZERO;
    delete blockHashes[b.blockHash];
  }
}
