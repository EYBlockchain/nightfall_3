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
import './ChallengesUtil.sol';


contract Challenges is Key_Registry, Proposers {

  /* // a transaction proof is challenged as incorrect
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
  } */

  /* // a transaction proof is challenged as incorrect.  Does not require the
  // index of the transaction in the block, but uses more Gas as it has to
  // search for it
  function challengeProofVerifies(
    Block memory blockL2,
    Transaction memory transaction
  ) external {
    isBlockReal(blockL2); // check the block exists
    for (uint i = 0; i < blockL2.transactionHashes.length; i++){
      if (transaction.transactionHash == blockL2.transactionHashes[i] ) {
        challengeProofVerifies(blockL2, transaction, i);
        return;
      }
    }
    revert('Transaction not found in this block');
  } */

  // the new commitment Merkle-tree root is challenged as incorrect
  function challengeNewRootCorrect(
    Block memory priorBlockL2, // the block immediately prior to this one
    Transaction[] memory priorBlockTransactions, // the transactions in the prior block
    bytes32[33] calldata frontierPriorBlock, // frontier path before prior block is added. The same frontier used in calculating root when prior block is added
    Block memory blockL2,
    Transaction[] memory transactions,
    uint commitmentIndex // the index *in the Merkle Tree* of the commitment that we are providing a SiblingPath for.
  ) external {
    // first, check we have real, in-train, contiguous blocks
    require(blockHashes[priorBlockL2.blockHash].nextHash == blockHashes[blockL2.blockHash].thisHash, 'The blocks are not contiguous');
    // check if the block hash is correct and the block hash exists for the prior block
    isBlockReal(priorBlockL2);
    isBlockHashCorrect(priorBlockL2);
    isBlockReal(blockL2);
    // check if the transaction hashes from prior transactions are in the prior block
    isBlockHashCorrect(blockL2);
    ChallengesUtil.libChallengeNewRootCorrect(priorBlockL2, priorBlockTransactions, frontierPriorBlock, blockL2, transactions, commitmentIndex);
    challengeAccepted(blockL2);
  }

  // the new commitment Merkle-tree root is challenged as incorrect
  function challengeNoDuplicateTransaction(
    Block memory block1,
    Block memory block2,
    uint transactionIndex1,
    uint transactionIndex2
  ) external {
    // first, check we have real, in-train, contiguous blocks
    isBlockReal(block1);
    isBlockHashCorrect(block1);
    isBlockReal(block2);
    isBlockHashCorrect(block2);
    // Check if a duplicate transaction exists in these blocks
    require(block1.transactionHashes[transactionIndex1] == block1.transactionHashes[transactionIndex2],
      'There is no duplicate transaction in these blocks');
    // Delete the latest block of the two
    if(blockHashes[block1.blockHash].data > blockHashes[block2.blockHash].data) {
      challengeAccepted(block1);
    } else {
      challengeAccepted(block2);
    }
  }

  // TODO more challenges must be added but these will do to demo the principle

  // This gets called when a challenge succeeds
  function challengeAccepted(Block memory badBlock) private {
    // emit the leafCount where the bad block was added. Timber will pick this
    // up and rollback its database to that point.
    emit Rollback(badBlock.root, badBlock.leafCount);
    // as we have a rollback, we need to reset the leafcount to the point
    // where the bad block was created.  Luckily, we noted that value in
    // the block when the block was proposed. It was check onchain so must be
    // correct.
    leafCount = badBlock.leafCount;
    // we need to remove the block that has been successfully
    // challenged from the linked list of blocks and all of the subsequent
    // blocks
    removeBlockHashes(badBlock.blockHash);
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
      emit BlockDeleted(hash);
      bytes32 nextHash = blockHashes[hash].nextHash;
      delete blockHashes[hash];
      hash = nextHash;
    } while(hash != ZERO);
    blockHashes[endHash].nextHash = ZERO; // terminate the chain correctly
  }

  // for dev purposes. Do not use in production
  function forceChallengeAccepted(Block memory anyBlock) external onlyOwner {
    challengeAccepted(anyBlock);
  }
}
