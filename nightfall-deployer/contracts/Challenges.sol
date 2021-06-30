// SPDX-License-Identifier: CC0-1.0

/**
Contract to enable someone to challenge a proposed transaction, on a number of
grounds.
@Author Westlad
*/

pragma solidity ^0.8.0;
//pragma experimental ABIEncoderV2;

import './Key_Registry.sol';
import './Utils.sol';
import './ChallengesUtil.sol';
import './Config.sol';
import './Stateful.sol';

contract Challenges is Stateful, Key_Registry, Config {
  mapping(bytes32 => address) public committers;

  // the new commitment Merkle-tree root is challenged as incorrect
  function challengeNewRootCorrect(
    Block memory priorBlockL2, // the block immediately prior to this one
    Transaction[] memory priorBlockTransactions, // the transactions in the prior block
    bytes32[33] calldata frontierPriorBlock, // frontier path before prior block is added. The same frontier used in calculating root when prior block is added
    Block memory blockL2,
    uint256 blockNumberL2,
    Transaction[] memory transactions,
    uint256 commitmentIndex, // the index *in the Merkle Tree* of the commitment that we are providing a SiblingPath for.
    bytes32 salt
  ) external {
    checkCommit(msg.data, salt);
    // check if the block hash is correct and the block hash exists for the block and prior block
    state.isBlockReal(priorBlockL2, priorBlockTransactions, blockNumberL2 - 1);
    state.isBlockReal(blockL2, transactions, blockNumberL2);
    // see if the challenge is valid
    ChallengesUtil.libChallengeNewRootCorrect(
      priorBlockL2,
      priorBlockTransactions,
      frontierPriorBlock,
      blockL2,
      transactions,
      commitmentIndex
    );
    challengeAccepted(blockL2, blockNumberL2);
  }

  function challengeNoDuplicateTransaction(
    Block memory block1,
    uint256 block1NumberL2,
    Block memory block2,
    uint256 block2NumberL2,
    Transaction[] memory transactions1,
    Transaction[] memory transactions2,
    uint256 transactionIndex1,
    uint256 transactionIndex2,
    bytes32 salt
  ) external {
    checkCommit(msg.data, salt);
    // first, check we have real, in-train, contiguous blocks
    state.isBlockReal(block1, transactions1, block1NumberL2);
    state.isBlockReal(block2, transactions2, block2NumberL2);
    require(
      Utils.hashTransaction(transactions1[transactionIndex1]) ==
      Utils.hashTransaction(transactions2[transactionIndex2]),
      'The transactions are not the same'
    );
    // Delete the latest block of the two
    if (block1NumberL2 > block2NumberL2) {
      challengeAccepted(block1, block1NumberL2);
    } else {
      challengeAccepted(block2, block2NumberL2);
    }
  }

  function challengeTransactionType(
    Block memory blockL2,
    uint256 blockNumberL2,
    Transaction[] memory transactions,
    uint256 transactionIndex,
    bytes32 salt
  ) external {
    checkCommit(msg.data, salt);
    state.isBlockReal(blockL2, transactions, blockNumberL2);
    ChallengesUtil.libChallengeTransactionType(transactions[transactionIndex]);
    // Delete the latest block of the two
    challengeAccepted(blockL2, blockNumberL2);
  }

  // This function signature is used when we have a non-zero historic root
  // i.e. transfer or withdraw transactions.
  function challengePublicInputHash(
    Block memory blockL2,
    uint256 blockNumberL2,
    Transaction[] memory transactions,
    uint256 transactionIndex,
    Block memory blockL2ContainingHistoricRoot,
    uint256 blockNumberL2ContainingHistoricRoot,
    Transaction[] memory transactionsOfblockL2ContainingHistoricRoot,
    bytes32 salt
  ) external {
    checkCommit(msg.data, salt);
    state.isBlockReal(blockL2, transactions, blockNumberL2);
    state.isBlockReal(
      blockL2ContainingHistoricRoot,
      transactionsOfblockL2ContainingHistoricRoot,
      blockNumberL2ContainingHistoricRoot
    );
    // check the historic root is in the block provided.
    require(
      transactions[transactionIndex].historicRootBlockNumberL2 ==
      blockNumberL2ContainingHistoricRoot,
      'Incorrect historic root block'
    );
    ChallengesUtil.libChallengePublicInputHash(
      transactions[transactionIndex],
      blockL2ContainingHistoricRoot.root
    );
    // Delete the latest block of the two
    challengeAccepted(blockL2, blockNumberL2);
  }

  // This function signature is used when we have a zero historic root
  // i.e. a deposit transaction.
  function challengePublicInputHash(
    Block memory blockL2,
    uint256 blockNumberL2,
    Transaction[] memory transactions,
    uint256 transactionIndex,
    bytes32 salt
  ) external {
    checkCommit(msg.data, salt);
    state.isBlockReal(blockL2, transactions, blockNumberL2);
    // check the historic root is in the block provided.
    ChallengesUtil.libChallengePublicInputHash(transactions[transactionIndex], ZERO);
    // Delete the latest block of the two
    challengeAccepted(blockL2, blockNumberL2);
  }

  function challengeProofVerification(
    Block memory blockL2,
    uint256 blockNumberL2,
    Transaction[] memory transactions,
    uint256 transactionIndex,
    uint256[8] memory uncompressedProof,
    bytes32 salt
  ) external {
    checkCommit(msg.data, salt);
    state.isBlockReal(blockL2, transactions, blockNumberL2);
    // now we need to check that the proof is correct
    ChallengesUtil.libCheckCompressedProof(
      transactions[transactionIndex].proof,
      uncompressedProof
    );
    ChallengesUtil.libChallengeProofVerification(
      uint256(transactions[transactionIndex].publicInputHash),
      uncompressedProof,
      vks[transactions[transactionIndex].transactionType]
    );
    challengeAccepted(blockL2, blockNumberL2);
  }

  /*
  This is a challenge that a nullifier has already been spent
  For this challenge to succeed a challenger provides:
  the indices for the same nullifier in two **different** transactions contained in two blocks (note it should also be ok for the blocks to be the same)
  */
  function challengeNullifier(
    Block memory block1,
    uint256 block1NumberL2,
    Transaction[] memory txs1,
    uint256 transactionIndex1,
    uint256 nullifierIndex1,
    Block memory block2,
    uint256 block2NumberL2,
    Transaction[] memory txs2,
    uint256 transactionIndex2,
    uint256 nullifierIndex2,
    bytes32 salt
  ) public {
    checkCommit(msg.data, salt);
    ChallengesUtil.libChallengeNullifier(
      txs1[transactionIndex1],
      nullifierIndex1,
      txs2[transactionIndex2],
      nullifierIndex2
    );
    state.isBlockReal(block1, txs1, block1NumberL2);
    state.isBlockReal(block2, txs2, block2NumberL2);

    // The blocks are different and we prune the later block of the two
    // as we have a block number, it's easy to see which is the latest.
    if (block1NumberL2 < block2NumberL2) {
      challengeAccepted(block2, block2NumberL2);
    } else {
      challengeAccepted(block1, block1NumberL2);
    }
  }

  function challengeHistoricRoot(
    Block memory blockL2,
    uint256 blockNumberL2,
    Transaction[] memory transactions,
    uint256 transactionIndex,
    bytes32 salt
  ) external {
    checkCommit(msg.data, salt);
    state.isBlockReal(blockL2, transactions, blockNumberL2);
    require(
      state.getNumberOfL2Blocks() <
      uint256(transactions[transactionIndex].historicRootBlockNumberL2),
      'Historic root in the transaction exists'
    );
    challengeAccepted(blockL2, blockNumberL2);
  }

  // This gets called when a challenge succeeds
  function challengeAccepted(Block memory badBlock, uint256 badBlockNumberL2) private {
    // Check to ensure that the block being challenged is less than a week old
    require(
      state.getBlockData(badBlockNumberL2).time >= (block.timestamp - 7 days),
      'Can only challenge blocks less than a week old'
    );
    // emit the leafCount where the bad block was added. Timber will pick this
    // up and rollback its database to that point.  We emit the event from
    // State.sol because Timber gets confused if its events come from two
    // different contracts (it uses the contract name as part of the db
    // connection - we need to change that).
    state.emitRollback(badBlockNumberL2, badBlock.leafCount);
    // as we have a rollback, we need to reset the leafcount to the point
    // where the bad block was created.  Luckily, we noted that value in
    // the block when the block was proposed. It was checked onchain so must be
    // correct.
    state.setLeafCount(badBlock.leafCount);
    // we need to remove the block that has been successfully
    // challenged from the linked list of blocks and all of the subsequent
    // blocks
    removeBlockHashes(badBlockNumberL2);
    // remove the proposer and give the proposer's block stake to the challenger
    state.removeProposer(badBlock.proposer);
    state.addPendingWithdrawal(msg.sender, BLOCK_STAKE);

    // TODO repay the fees of the transactors and any escrowed funds held by the
    // Shield contract.
  }

  function removeBlockHashes(uint256 blockNumberL2) internal {
    uint256 lastBlock = state.getNumberOfL2Blocks() - 1;
    for (uint256 i = lastBlock; i >= blockNumberL2; i--) {
      state.popBlockData();
    }
    require(
      state.getNumberOfL2Blocks() == blockNumberL2,
      'After removing blocks, the number remaining is not as expected.'
    );
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
