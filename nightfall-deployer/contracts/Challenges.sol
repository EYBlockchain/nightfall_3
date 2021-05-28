// SPDX-License-Identifier: CC0-1.0

/**
Contract to enable someone to challenge a proposed transaction, on a number of
grounds.
@Author Westlad
*/

pragma solidity ^0.8.0;
//pragma experimental ABIEncoderV2;

import './Proposals.sol';
import './Key_Registry.sol';
import './Utils.sol';
import './ChallengesUtil.sol';


contract Challenges is Proposals, Key_Registry {

  mapping(bytes32 => address) public committers;

  constructor(address proposersAddr) Proposals(proposersAddr) {}

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
    // check if the block hash is correct and the block hash exists for the block and prior block
    isBlockReal(priorBlockL2, priorBlockTransactions);
    isBlockReal(blockL2, transactions);
    require(priorBlockL2.blockNumberL2 + 1 == blockL2.blockNumberL2, 'The blocks are not contiguous');
    // see if the challenge is valid
    ChallengesUtil.libChallengeNewRootCorrect(priorBlockL2, priorBlockTransactions, frontierPriorBlock, blockL2, transactions, commitmentIndex);
    challengeAccepted(blockL2);
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
    isBlockReal(block1, transactions1);
    isBlockReal(block2, transactions2);
    require(Utils.hashTransaction(transactions1[transactionIndex1]) == Utils.hashTransaction(transactions2[transactionIndex2]), 'The transactions are not the same');
    // Delete the latest block of the two
    if(block1.blockNumberL2 > block2.blockNumberL2) {
      challengeAccepted(block1);
    } else {
      challengeAccepted(block2);
    }
  }

  function challengeTransactionType(
    Block memory blockL2,
    Transaction[] memory transactions,
    uint transactionIndex,
    bytes32 salt
    ) external {
    checkCommit(msg.data, salt);
    isBlockReal(blockL2, transactions);
    ChallengesUtil.libChallengeTransactionType(transactions[transactionIndex]);
    // Delete the latest block of the two
    challengeAccepted(blockL2);
  }

  // This function signature is used when we have a non-zero historic root
  // i.e. transfer or withdraw transactions.
  function challengePublicInputHash(
    Block memory blockL2,
    Transaction[] memory transactions,
    uint transactionIndex,
    Block memory blockL2ContainingHistoricRoot,
    Transaction[] memory transactionsOfblockL2ContainingHistoricRoot,
    bytes32 salt
    ) external {
    checkCommit(msg.data, salt);
    isBlockReal(blockL2, transactions);
    isBlockReal(
      blockL2ContainingHistoricRoot, transactionsOfblockL2ContainingHistoricRoot
    );
    // check the historic root is in the block provided.
    require(
      transactions[transactionIndex].historicRootBlockNumberL2 == blockL2ContainingHistoricRoot.blockNumberL2,
      'Incorrect historic root block'
    );
    ChallengesUtil.libChallengePublicInputHash(transactions[transactionIndex], blockL2ContainingHistoricRoot.root);
    // Delete the latest block of the two
    challengeAccepted(blockL2);
  }

  // This function signature is used when we have a zero historic root
  // i.e. a deposit transaction.
  function challengePublicInputHash(
    Block memory blockL2,
    Transaction[] memory transactions,
    uint transactionIndex,
    bytes32 salt
    ) external {
    checkCommit(msg.data, salt);
    isBlockReal(blockL2, transactions);
    // check the historic root is in the block provided.
    ChallengesUtil.libChallengePublicInputHash(transactions[transactionIndex], ZERO);
    // Delete the latest block of the two
    challengeAccepted(blockL2);
  }

  function challengeProofVerification(
    Block memory blockL2,
    Transaction[] memory transactions,
    uint transactionIndex,
    uint[8] memory uncompressedProof,
    bytes32 salt
    ) external {
      checkCommit(msg.data, salt);
      isBlockReal(blockL2, transactions);
      // now we need to check that the proof is correct
      ChallengesUtil.libCheckCompressedProof(transactions[transactionIndex].proof, uncompressedProof);
      ChallengesUtil.libChallengeProofVerification(uint(transactions[transactionIndex].publicInputHash), uncompressedProof, vks[transactions[transactionIndex].transactionType]);
      challengeAccepted(blockL2);
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
    isBlockReal(block1, txs1);
    isBlockReal(block2, txs2);

    // The blocks are different and we prune the later block of the two
    // as we have a block number, it's easy to see which is the latest.
    if (block1.blockNumberL2 < block2.blockNumberL2){
      challengeAccepted(block2);
    } else {
      challengeAccepted(block1);
    }
  }

  // This gets called when a challenge succeeds
  function challengeAccepted(Block memory badBlock) private {
    // Check to ensure that the block being challenged is less than a week old
    require(blockHashes[badBlock.blockNumberL2].time >= (block.timestamp - 7 days) , 'Can only challenge blocks less than a week old');
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
    removeBlockHashes(badBlock.blockNumberL2);
    // remove the proposer and give the proposer's block stake to the challenger
    removeProposer(badBlock.proposer, msg.sender);
    // TODO repay the fees of the transactors and any escrowed funds held by the
    // Shield contract.
  }

  function removeBlockHashes(uint blockNumberL2) internal {
    uint lastBlock = blockHashes.length - 1;
    for (uint i = lastBlock; i >= blockNumberL2; i--) {
      emit BlockDeleted(blockHashes[i].blockHash); // TODO - makes more sense to eventually emit the block number, rather than the blockHash.
      blockHashes.pop();
    }
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
