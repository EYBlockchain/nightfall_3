// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import './Utils.sol';
import './Verifier.sol';
import './MerkleTree_Stateless.sol';
import './Structures.sol';

library ChallengesUtil {

  bytes32 public constant ZERO = 0x0000000000000000000000000000000000000000000000000000000000000000;

  function libChallengeProofVerification(
    Structures.Transaction memory transaction,
    uint256[] memory vk
  ) public {
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
        if(transaction.commitments[i] == ZERO)
          nZeroCommitments++;
      }
      uint nZeroNullifiers;
      for (uint i = 0; i < transaction.nullifiers.length; i++) {
        if(transaction.nullifiers[i] == ZERO)
          nZeroNullifiers++;
      }
      uint nZeroProof;
      for (uint i = 0; i < transaction.proof.length; i++) {
        if(transaction.proof[i] == 0)
          nZeroProof++;
      }
      require(
        transaction.publicInputHash == ZERO ||
        (transaction.tokenId == ZERO && transaction.value == ZERO) ||
        transaction.ercAddress == ZERO ||
        transaction.recipientAddress != ZERO ||
        nZeroCommitments > 0 ||
        transaction.commitments.length != 1 ||
        nZeroNullifiers == 0 ||
        /* transaction.nullifiers.length != 0 || // TODO in NO */
        transaction.historicRoot != ZERO ||
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
        if(transaction.commitments[i] == ZERO)
          nZeroCommitments++;
      }
      uint nZeroNullifiers;
      for (uint i = 0; i < transaction.nullifiers.length; i++) {
        if(transaction.nullifiers[i] == ZERO)
          nZeroNullifiers++;
      }
      uint nZeroProof;
      for (uint i = 0; i < transaction.proof.length; i++) {
        if(transaction.proof[i] == 0)
          nZeroProof++;
      }
      require(
        transaction.publicInputHash == ZERO ||
        transaction.tokenId != ZERO ||
        transaction.value != ZERO ||
        transaction.ercAddress == ZERO ||
        transaction.recipientAddress != ZERO ||
        nZeroCommitments > 0 ||
        transaction.commitments.length != 1 ||
        nZeroNullifiers > 0 ||
        transaction.nullifiers.length != 1 ||
        transaction.historicRoot == ZERO ||
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
        if(transaction.commitments[i] == ZERO)
          nZeroCommitments++;
      }
      uint nZeroNullifiers;
      for (uint i = 0; i < transaction.nullifiers.length; i++) {
        if(transaction.nullifiers[i] == ZERO)
          nZeroNullifiers++;
      }
      uint nZeroProof;
      for (uint i = 0; i < transaction.proof.length; i++) {
        if(transaction.proof[i] == 0)
          nZeroProof++;
      }
      require(
        transaction.publicInputHash == ZERO ||
        transaction.tokenId != ZERO ||
        transaction.value != ZERO ||
        transaction.ercAddress == ZERO ||
        transaction.recipientAddress != ZERO ||
        nZeroCommitments > 0 ||
        transaction.commitments.length != 2 ||
        nZeroNullifiers > 0 ||
        transaction.nullifiers.length != 2 ||
        transaction.historicRoot == ZERO ||
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
        if(transaction.commitments[i] == ZERO)
          nZeroCommitments++;
      }
      uint nZeroNullifiers;
      for (uint i = 0; i < transaction.nullifiers.length; i++) {
        if(transaction.nullifiers[i] == ZERO)
          nZeroNullifiers++;
      }
      uint nZeroProof;
      for (uint i = 0; i < transaction.proof.length; i++) {
        if(transaction.proof[i] == 0)
          nZeroProof++;
      }
      require(
        transaction.publicInputHash == ZERO ||
        (transaction.tokenId == ZERO && transaction.value == ZERO) ||
        transaction.ercAddress == ZERO ||
        transaction.recipientAddress == ZERO ||
        nZeroCommitments == 0 ||
        /* transaction.commitments.length != 0 || // TODO in NO */
        nZeroNullifiers > 0 ||
        transaction.nullifiers.length != 1 ||
        transaction.historicRoot == ZERO ||
        nZeroProof > 0,
        'This withdraw transaction type is valid'
      );
    }

    // the transaction type withdraw is challenged to not be valid
    function libChallengePublicInputHashDeposit(
      Structures.Transaction memory transaction
    ) internal {
      require(
        transaction.publicInputHash != sha256(
          abi.encodePacked(transaction.ercAddress, transaction.tokenId, transaction.value, transaction.commitments)
        ) & 0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, // select 248 bits of the sha256 calculated
        "publicInputHash for deposit is correct"
      );
    }

    // the transaction type withdraw is challenged to not be valid
    function libChallengePublicInputHashSingleTransfer(
      Structures.Transaction memory transaction
    ) internal {
      require(
        transaction.publicInputHash != sha256(
          abi.encodePacked(transaction.ercAddress, transaction.commitments, transaction.nullifiers, transaction.historicRoot)
        ) & 0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, // select 248 bits of the sha256 calculated
        "publicInputHash for single transfer is correct"
      );
    }

    // the transaction type withdraw is challenged to not be valid
    function libChallengePublicInputHashDoubleTransfer(
      Structures.Transaction memory transaction
    ) internal {
      require(
        transaction.publicInputHash != sha256(
          abi.encodePacked(transaction.ercAddress, transaction.ercAddress, transaction.commitments, transaction.nullifiers, transaction.historicRoot)
        ) & 0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, // select 248 bits of the sha256 calculated
        "publicInputHash for double transfer is correct"
      );
    }

    // the transaction type withdraw is challenged to not be valid
    function libChallengePublicInputHashWithdraw(
      Structures.Transaction memory transaction
    ) internal {
      require(
        transaction.publicInputHash != sha256(
          abi.encodePacked(transaction.ercAddress, transaction.tokenId, transaction.value, transaction.nullifiers, transaction.recipientAddress, transaction.historicRoot)
        ) & 0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, // select 248 bits of the sha256 calculated
        "publicInputHash for withdraw is correct"
      );
    }
}
