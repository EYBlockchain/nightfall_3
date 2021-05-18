// SPDX-License-Identifier: CC0-1.0

/**
Contract to enable someone to challenge a proposed transaction, on a number of
grounds.
@Author Westlad
*/

pragma solidity ^0.8.0;
//pragma experimental ABIEncoderV2;

import './Proposers.sol';
import './Key_Registry.sol';
import './Utils.sol';
import './ChallengesUtil.sol';


contract Challenges is Proposers, Key_Registry {

  mapping(bytes32 => address) public committers;

  // the new commitment Merkle-tree root is challenged as incorrect
  function challengeNewRootCorrect(
    Block memory priorBlockL2, // the block immediately prior to this one
    Transaction[] memory priorBlockTransactions, // the transactions in the prior block
    bytes32[33] calldata frontierPriorBlock, // frontier path before prior block is added. The same frontier used in calculating root when prior block is added
    Block memory blockL2,
    Transaction[] memory transactions,
    uint commitmentIndex, // the index *in the Merkle Tree* of the commitment that we are providing a SiblingPath for.
    bytes32 salt
  ) external {
    checkCommit(msg.data, salt);
    bytes32 priorBlockL2Hash = isBlockReal(priorBlockL2,priorBlockTransactions);
    bytes32 blockL2Hash = isBlockReal(blockL2, transactions);
    // first, check we have real, in-train, contiguous blocks
    require(blockHashes[priorBlockL2Hash].nextHash == blockHashes[blockL2Hash].thisHash, 'The blocks are not contiguous');
    // check if the block hash is correct and the block hash exists for the prior block
    ChallengesUtil.libChallengeNewRootCorrect(priorBlockL2, priorBlockTransactions, frontierPriorBlock, blockL2, transactions, commitmentIndex);
    challengeAccepted(blockL2, blockL2Hash);
  }

  function challengeNoDuplicateTransaction(
    Block memory block1,
    Block memory block2,
    Transaction[] memory transactions1,
    Transaction[] memory transactions2,
    uint transactionIndex1,
    uint transactionIndex2,
    bytes32 salt
  ) external {
    checkCommit(msg.data, salt);
    // first, check we have real, in-train, contiguous blocks
    bytes32 block1Hash = isBlockReal(block1, transactions1);
    bytes32 block2Hash = isBlockReal(block2, transactions2);
    require(Utils.hashTransaction(transactions1[transactionIndex1]) == Utils.hashTransaction(transactions2[transactionIndex2]), 'The transactions are not, in fact, the same');
    // Delete the latest block of the two
    if(blockHashes[block1Hash].data > blockHashes[block2Hash].data) {
      challengeAccepted(block1, block1Hash);
    } else {
      challengeAccepted(block2, block2Hash);
    }
  }

  function challengeTransactionType(
    Block memory blockL2,
    Transaction[] memory transactions,
    uint transactionIndex,
    bytes32 salt
    ) external {
      checkCommit(msg.data, salt);
      bytes32 blockL2Hash = isBlockReal(blockL2, transactions);
      ChallengesUtil.libChallengeTransactionType(transactions[transactionIndex]);
      // Delete the latest block of the two
      challengeAccepted(blockL2, blockL2Hash);
  }

  function challengePublicInputHash(
    Block memory blockL2,
    Transaction[] memory transactions,
    uint transactionIndex,
    bytes32 salt
    ) external {
      checkCommit(msg.data, salt);
      bytes32 blockL2Hash = isBlockReal(blockL2, transactions);
      ChallengesUtil.libChallengePublicInputHash(transactions[transactionIndex]);
      // Delete the latest block of the two
      challengeAccepted(blockL2, blockL2Hash);
  }

  function challengeProofVerification(
    Block memory blockL2,
    Transaction[] memory transactions,
    uint transactionIndex,
    bytes32 salt
    ) external {
      checkCommit(msg.data, salt);
      bytes32 blockL2Hash = isBlockReal(blockL2, transactions);
      ChallengesUtil.libChallengeProofVerification(transactions[transactionIndex], vks[transactions[transactionIndex].transactionType]);
      challengeAccepted(blockL2, blockL2Hash);
  }

  /*
   This is a challenge that a nullifier has already been spent
   For this challenge to succeed a challenger provides:
   the indices for the same nullifier in two **different** transactions contained in two blocks (note it should also be ok for the blocks to be the same)
  */
  function challengeNullifier(
    Block memory block1,
    Transaction[] memory txs1,
    uint transactionIndex1,
    uint nullifierIndex1,
    Block memory block2,
    Transaction[] memory txs2,
    uint transactionIndex2,
    uint nullifierIndex2,
    bytes32 salt
  ) public {
    checkCommit(msg.data, salt);
    ChallengesUtil.libChallengeNullifier(txs1[transactionIndex1], nullifierIndex1, txs2[transactionIndex2], nullifierIndex2);
    bytes32 block1Hash = isBlockReal(block1, txs1);
    bytes32 block2Hash = isBlockReal(block2, txs2);

    if (block1Hash == block2Hash){ //They are the same block
      challengeAccepted(block1, block1Hash);
    }
    // The blocks are different and we prune the later block of the two
    // simplest first check is to use the timestamp
    if (blockHashes[block1Hash].data > blockHashes[block2Hash].data){
      challengeAccepted(block1, block1Hash);
    } else if (blockHashes[block1Hash].data < blockHashes[block2Hash].data) {
      challengeAccepted(block2, block2Hash);
    } else {
      // They are within the same L1 blocktime so we need to walk the linked hashmap
      bytes32 checkHash = endHash;

      // TODO Check safety of this condition (gas costs?)
      while(blockHashes[checkHash].previousHash != ZERO) {
          if(blockHashes[checkHash].previousHash == block1Hash) {
            challengeAccepted(block1, block1Hash);
            break;
          }
          if(blockHashes[checkHash].previousHash == block2Hash) {
            challengeAccepted(block2, block2Hash);
            break;
          }
          checkHash = blockHashes[checkHash].previousHash;
      }
    }
  }

  // This gets called when a challenge succeeds
  function challengeAccepted(Block memory badBlock, bytes32 badBlockHash) private {
    // Check to ensure that the block being challenged is less than a week old
    require(blockHashes[badBlockHash].data >= (block.timestamp - 7 days) , 'Can only challenge blocks less than a week old');
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
    removeBlockHashes(badBlockHash);
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

  //To prevent frontrunning, we need to commit to a challenge before we send it
  function commitToChallenge(bytes32 commitHash) external {
    require(committers[commitHash] == address(0), 'This hash is already committed to');
    committers[commitHash] = msg.sender;
    emit CommittedToChallenge(commitHash, msg.sender);
  }
  // and having sent it, we need to check that commitment to a challenge from
  // within the challenge function using this function:
  function checkCommit(bytes calldata messageData, bytes32 salt) private {
    bytes32 hash = keccak256(messageData);
    salt = 0; // not really required as salt is in msg.data but stops the unused variable compiler warning. Bit of a waste of gas though.
    require(committers[hash] == msg.sender, 'The commitment hash is invalid');
    delete committers[hash];
  }
}
