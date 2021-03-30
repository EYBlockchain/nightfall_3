// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import './Utils.sol';
import './Verifier.sol';
import './MerkleTree_Stateless.sol';
import './Structures.sol';

library ChallengesUtil {

  function libChallengeProofVerifies(
    Structures.Block memory blockL2,
    Structures.Transaction memory transaction,
    uint transactionIndex, // the location of the transaction in the block (saves a loop)
    uint256[] memory vk
  ) public {
    require(
      blockL2.transactionHashes[transactionIndex] == Utils.hashTransaction(transaction),
      'This transaction is not in the block at the index given'
    );
    require(!Verifier.verify(
        transaction.proof,
        uint256(transaction.publicInputHash),
        vk),
      'This proof appears to be valid'
    );
  }

  function libChallengeNewRootCorrect(
    Structures.Block memory priorBlockL2, // the block immediately prior to this one
    Structures.Transaction[] memory priorBlockTransactions, // the transactions in the prior block
    bytes32[33] calldata frontierPriorBlock, // frontier path before prior block is added. The same frontier used in calculating root when prior block is added
    Structures.Block memory blockL2,
    Structures.Transaction[] memory transactions,
    uint commitmentIndex // the index *in the Merkle Tree* of the commitment that we are providing a SiblingPath for.
  ) public pure {
  uint nCommitmentsPriorBlock;
  for (uint i = 0; i < priorBlockTransactions.length; i++) {
    require(
      priorBlockL2.transactionHashes[i] == Utils.hashTransaction(priorBlockTransactions[i]),
      'Transaction hash was not found'
    );
    nCommitmentsPriorBlock += priorBlockTransactions[i].commitments.length; // remember how many commitments are in the block
  }

  //calculate the number of commitments in prior block
  bytes32[] memory commitmentsPriorBlock = new bytes32[](nCommitmentsPriorBlock);
  uint l;
  for (uint i = 0; i < priorBlockTransactions.length; i++) {
    for (uint j = 0; j < priorBlockTransactions[i].commitments.length; j++)
      commitmentsPriorBlock[l++] = priorBlockTransactions[i].commitments[j];
  }
  // next check the sibling path is valid and get the Frontier
  // (bool valid, bytes32[33] memory _frontier) = getPath(commitmentsPriorBlock, frontierPriorBlock,priorBlockL2.leafCount, priorBlockL2.root);
    bool valid;
    bytes32[33] memory _frontier;
    (valid, _frontier) = MerkleTree_Stateless.checkPath(
      commitmentsPriorBlock,
      frontierPriorBlock,
      priorBlockL2.leafCount,
      priorBlockL2.root
    );
  require(valid, 'The sibling path is invalid');

  uint nCommitments;
    for (uint i = 0; i < transactions.length; i++) {
      require(
        blockL2.transactionHashes[i] == Utils.hashTransaction(transactions[i]),
        'Transaction hash was not found'
      );
      nCommitments += transactions[i].commitments.length; // remember how many commitments are in the block
    }

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
  }

    // the transaction type deposit is challenged to not be valid
    function libChallengeTransactionTypeDeposit(
      Structures.Transaction memory transaction
    ) internal {
      // Check if a duplicate transaction exists in these blocks
      uint nZeroCommitments;
      for (uint i = 0; i < transaction.commitments.length; i++) {
        if(transaction.commitments[i].length == 0)
          nZeroCommitments++;
      }
      uint nZeroNullifiers;
      for (uint i = 0; i < transaction.commitments.length; i++) {
        if(transaction.commitments[i].length == 0)
          nZeroNullifiers++;
      }
      uint nZeroProof;
      for (uint i = 0; i < transaction.commitments.length; i++) {
        if(transaction.commitments[i].length == 0)
          nZeroProof++;
      }
      require(
        transaction.publicInputHash.length == 0 ||
        (transaction.tokenId.length == 0 && transaction.value.length == 0) ||
        transaction.ercAddress.length == 0 ||
        transaction.recipientAddress.length != 0 ||
        nZeroCommitments > 0 ||
        transaction.commitments.length != 1 ||
        nZeroNullifiers > 0 ||
        transaction.nullifiers.length != 0 || // TODO in NO
        transaction.historicRoot.length != 0 ||
        nZeroProof > 0,
        'This deposit transaction type is valid'
      );
    }

    // the transaction type single transfer is challenged to not be valid
    function libChallengeTransactionTypeSingleTransfer(
      Structures.Transaction memory transaction
    ) internal {
      // Check if a duplicate transaction exists in these blocks
      uint nZeroCommitments;
      for (uint i = 0; i < transaction.commitments.length; i++) {
        if(transaction.commitments[i].length == 0)
          nZeroCommitments++;
      }
      uint nZeroNullifiers;
      for (uint i = 0; i < transaction.commitments.length; i++) {
        if(transaction.commitments[i].length == 0)
          nZeroNullifiers++;
      }
      uint nZeroProof;
      for (uint i = 0; i < transaction.commitments.length; i++) {
        if(transaction.commitments[i].length == 0)
          nZeroProof++;
      }
      require(
        transaction.publicInputHash.length == 0 ||
        transaction.tokenId.length != 0 ||
        transaction.value.length != 0 ||
        transaction.ercAddress.length == 0 ||
        transaction.recipientAddress.length != 0 ||
        nZeroCommitments > 0 ||
        transaction.commitments.length != 1 ||
        nZeroNullifiers > 0 ||
        transaction.nullifiers.length != 1 ||
        transaction.historicRoot.length == 0 ||
        nZeroProof > 0,
        'This single transfer transaction type is valid'
      );
    }

    // the transaction type double transfer is challenged to not be valid
    function libChallengeTransactionTypeDoubleTransfer(
      Structures.Transaction memory transaction
    ) internal {
      // Check if a duplicate transaction exists in these blocks
      uint nZeroCommitments;
      for (uint i = 0; i < transaction.commitments.length; i++) {
        if(transaction.commitments[i].length == 0)
          nZeroCommitments++;
      }
      uint nZeroNullifiers;
      for (uint i = 0; i < transaction.commitments.length; i++) {
        if(transaction.commitments[i].length == 0)
          nZeroNullifiers++;
      }
      uint nZeroProof;
      for (uint i = 0; i < transaction.commitments.length; i++) {
        if(transaction.commitments[i].length == 0)
          nZeroProof++;
      }
      require(
        transaction.publicInputHash.length == 0 ||
        transaction.tokenId.length != 0 ||
        transaction.value.length != 0 ||
        transaction.ercAddress.length == 0 ||
        transaction.recipientAddress.length != 0 ||
        nZeroCommitments > 0 ||
        transaction.commitments.length != 2 ||
        nZeroNullifiers > 0 ||
        transaction.nullifiers.length != 2 ||
        transaction.historicRoot.length == 0 ||
        nZeroProof > 0,
        'This double transfer transaction type is valid'
      );
    }

    // the transaction type withdraw is challenged to not be valid
    function libChallengeTransactionTypeWithdraw(
      Structures.Transaction memory transaction
    ) internal {
      // Check if a duplicate transaction exists in these blocks
      uint nZeroCommitments;
      for (uint i = 0; i < transaction.commitments.length; i++) {
        if(transaction.commitments[i].length == 0)
          nZeroCommitments++;
      }
      uint nZeroNullifiers;
      for (uint i = 0; i < transaction.commitments.length; i++) {
        if(transaction.commitments[i].length == 0)
          nZeroNullifiers++;
      }
      uint nZeroProof;
      for (uint i = 0; i < transaction.commitments.length; i++) {
        if(transaction.commitments[i].length == 0)
          nZeroProof++;
      }
      require(
        transaction.publicInputHash.length == 0 ||
        (transaction.tokenId.length == 0 && transaction.value.length == 0) ||
        transaction.ercAddress.length == 0 ||
        transaction.recipientAddress.length == 0 ||
        nZeroCommitments > 0 ||
        transaction.commitments.length != 0 || // TODO in NO
        nZeroNullifiers > 0 ||
        transaction.nullifiers.length != 1 ||
        transaction.historicRoot.length == 0 ||
        nZeroProof > 0,
        'This withdraw transaction type is valid'
      );
    }
}
