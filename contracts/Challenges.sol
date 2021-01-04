// SPDX-License-Identifier: CC0-1.0

/**
Contract to enable someone to challenge a proposed transaction, on a number of
grounds.
@Author Westlad
*/

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import './Verifier.sol';
import './Utils.sol';
import './Key_Registry.sol';
import './MerkleTree_Stateless.sol';

contract Challenges is Utils, Verifier, Key_Registry, MerkleTree_Stateless {

  enum ChallengeType { //TODO - remove but it's a handy reminder for now
    PROOF_VERIFIES,
    PUBLIC_INPUT_HASH_VALID,
    HISTORIC_ROOT_EXISTS,
    NULLIFIER_ABSENT,
    NEW_ROOT_CORRECT
  }

  // a transaction proof is challenged as incorrect
  function challengeProofVerifies(
    Block memory blockL2,
    Transaction memory transaction,
    uint transactionIndex // the location of the transaction in the block (saves a loop)
  ) public {
    isBlockReal(blockL2); // check the block exists
    require(
      blockL2.transactionHashes[transactionIndex] == hashTransaction(transaction),
      'This transaction is not in the block at the index given'
    );
    require(!Verifier.verify(
        transaction.proof,
        uint256(transaction.publicInputHash),
        vks[transaction.transactionType]),
      'This proof appears to be valid'
    );
    challengeAccepted(blockL2.blockHash);
  }

  // a transaction proof is challenged as incorrect.  Does not require the
  // index of the transaction in the block, but uses more Gas as it has to
  // search for it
  function challengeProofVerifies(
    Block memory blockL2,
    Transaction memory transaction
  ) external {
    for (uint i = 0; i < blockL2.transactionHashes.length; i++){
      if (transaction.transactionHash == blockL2.transactionHashes[i] ) {
        challengeProofVerifies(blockL2, transaction, i);
        return;
      }
    }
    revert('Transaction not found in this block');
  }

  // the new commitment-Merkle-tree root is challenged as incorrect
  function challengeNewRootCorrect(
    Block memory priorBlockL2, // the block immediately prior to this one
    Transaction memory priorBlockL2LastTransaction,
    Block memory blockL2,
    Transaction[] memory transactions,
    bytes32[33] calldata siblingPath, // sibling path for the last commitment in the prior block, (which we assume is correct or it will be challenged)
    uint commitmentIndex // the index *in the Merkle Tree* of the commitment that we are providing a SiblingPath for.
  ) external {
    // first, check we have real, in-train, contiguous blocks
    require(priorBlockL2.blockNonce + 1 == blockL2.blockNonce, 'The blocks are not contiguous');
    isBlockReal(blockL2);
    isBlockReal(priorBlockL2);
    // next, check that we have the correct transactions. We do that by checking that the hashes of the commitments match those stored in the block. Also, while we're at it, save all the commitments for later.
    uint nCommitments;
    for (uint i = 0; i < transactions.length; i++) {
      require(
        blockL2.transactionHashes[i] == hashTransaction(transactions[i]),
        'Transaction hash was not found'
      );
      nCommitments += transactions[i].commitments.length; // remember how many commitments are in the block
    }
    require(
      priorBlockL2.transactionHashes[priorBlockL2.transactionHashes.length - 1] == hashTransaction(priorBlockL2LastTransaction),
      'Last transaction of prior block is invalid'
    );
    // next check the sibling path is valid and get the Frontier
    (bool valid, bytes32[33] memory _frontier) = checkPath(
      siblingPath,
      commitmentIndex,
      priorBlockL2LastTransaction.commitments[priorBlockL2LastTransaction.commitments.length - 1],
      priorBlockL2.root
    );
    require(valid, 'The sibling path is invalid');
    // next, let's get all the commitments in the block, togther in an array
    // we could do this with less code by making commitments 'storage' and pushing to the end of the array but it's a waste of Gas because we don't want to keep the commitments.
    bytes32[] memory commitments = new bytes32[](nCommitments);
    uint k;
    for (uint i = 0; i < transactions.length; i++) {
      for (uint j = 0; j < transactions[i].commitments.length; j++)
        commitments[k++] = transactions[i].commitments[j];
    }
    // At last, we can check if the root itself is correct!
    (bytes32 root, , ) = insertLeaves(commitments, _frontier, commitmentIndex);
    require(root != blockL2.root, 'The root is actually fine');
    challengeAccepted(blockL2.blockHash);
  }

  // TODO more challenges must be added but these will do to demo the principle

  //TODO This should do something when a challenge succeeds
  function challengeAccepted(bytes32 blockHash) private {
    // first of all, we need to remove the block that has been successfully
    // challenged from the linked list of blocks and splice the list together
    // again
    bytes32 previousHash = blockHashes[blockHash].previousHash;
    bytes32 nextHash = blockHashes[blockHash].nextHash;
    delete blockHashes[blockHash];
    blockHashes[previousHash].nextHash = blockHashes[nextHash].hash;
    blockHashes[nextHash].previousHash = blockHashes[previousHash].hash;
    emit RejectedProposedblock(blockHash);
    // remove the proposer
//    TODO on return, write a function to remove proposer from circular linked list
// update add and remove proposer functions to use a circular linked list AND
// worry about how to initialise it
    // give all bond's value to the challenger.
    pendingWithdrawals[msg.sender] +=
//TODO proposer pays a block stake whcih they get back if block isn't chllenged
// successful challenge pays blockstake to challenger
// fees go to proposer or are returned in case of successful challenge

  }


  // Checks if a block is actually referenced in the queue of blocks waiting
  // to go into the Shield state (stops someone challenging with a non-existent
  // block).
  function isBlockReal(Block memory b) public view {
    require(b.blockHash == hashBlock(b), 'The block hash is incorrect');
    require(blockHashes[b.blockHash].hash == b.blockHash, 'This block does not exist');
  }
}
