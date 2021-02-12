// SPDX-License-Identifier: CC0-1.0

/**
Contract to enable someone to challenge a proposed transaction, on a number of
grounds.
@Author Westlad
*/

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import './Verifier.sol';
import './Proposers.sol';
import './Key_Registry.sol';
import './MerkleTree_Stateless.sol';
import './Utils.sol';

contract Challenges is Key_Registry, Proposers {

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
      blockL2.transactionHashes[transactionIndex] == Utils.hashTransaction(transaction),
      'This transaction is not in the block at the index given'
    );
    require(!Verifier.verify(
        transaction.proof,
        uint256(transaction.publicInputHash),
        vks[transaction.transactionType]),
      'This proof appears to be valid'
    );
    challengeAccepted(blockL2);
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

  // the new commitment Merkle-tree root is challenged as incorrect
  function challengeNewRootCorrect(
    Block memory priorBlockL2, // the block immediately prior to this one
    Transaction memory priorBlockL2LastTransaction,
    Block memory blockL2,
    Transaction[] memory transactions,
    bytes32[33] calldata siblingPath, // sibling path for the last commitment in the prior block, (which we assume is correct or it will be challenged)
    uint commitmentIndex // the index *in the Merkle Tree* of the commitment that we are providing a SiblingPath for.
  ) external {
    // first, check we have real, in-train, contiguous blocks
    require(blockHashes[priorBlockL2.blockHash].nextHash == blockHashes[blockL2.blockHash].previousHash, 'The blocks are not contiguous');
    isBlockReal(blockL2);
    isBlockReal(priorBlockL2);
    // next, check that we have the correct transactions. We do that by checking that the hashes of the commitments match those stored in the block. Also, while we're at it, save all the commitments for later.
    uint nCommitments;
    for (uint i = 0; i < transactions.length; i++) {
      require(
        blockL2.transactionHashes[i] == Utils.hashTransaction(transactions[i]),
        'Transaction hash was not found'
      );
      nCommitments += transactions[i].commitments.length; // remember how many commitments are in the block
    }
    require(
      priorBlockL2.transactionHashes[priorBlockL2.transactionHashes.length - 1] == Utils.hashTransaction(priorBlockL2LastTransaction),
      'Last transaction of prior block is invalid'
    );
    // next check the sibling path is valid and get the Frontier
    (bool valid, bytes32[33] memory _frontier) = MerkleTree_Stateless.checkPath(
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
    (bytes32 root, , ) = MerkleTree_Stateless.insertLeaves(commitments, _frontier, commitmentIndex);
    require(root != blockL2.root, 'The root is actually fine');
    challengeAccepted(blockL2);
  }

  // TODO more challenges must be added but these will do to demo the principle

  // This gets called when a challenge succeeds
  function challengeAccepted(Block memory badBlock) private {
    // first of all, we need to remove the block that has been successfully
    // challenged from the linked list of blocks and all of the subsequent
    // blocks
    removeBlockHashes(badBlock.blockHash);
    emit RejectedProposedBlock(badBlock.blockHash);
    // remove the proposer and re-join the chain where they've been removed
    removeProposer(badBlock.proposer);
    // give the proposer's block stake to the challenger
    pendingWithdrawals[msg.sender] += BLOCK_STAKE;
    // TODO repay the fees of the transactors and any escrowed funds held by the
    // Shield contract.
  }

  function removeBlockHashes(bytes32 blockHash) internal {
    bytes32 hash = blockHash;
    endHash = blockHashes[hash].previousHash;
    do {
      bytes32 nextHash = blockHashes[hash].nextHash;
      delete blockHashes[hash];
      hash = nextHash;
    } while(blockHashes[hash].nextHash != ZERO);
  }
}
