// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.0;
//pragma experimental ABIEncoderV2;

import './Utils.sol';
import './Verifier.sol';
import './MerkleTree_Stateless.sol';
import './Structures.sol';

library ChallengesUtil {

  bytes32 public constant ZERO = 0x0000000000000000000000000000000000000000000000000000000000000000;

    function libChallengeNewRootCorrect(
      /* TODO we can probably use the fact that the blocks now contain the
      number of commitments to shorten this code
      */
      Structures.Block memory priorBlockL2, // the block immediately prior to this one
      Structures.Transaction[] memory priorBlockTransactions, // the transactions in the prior block
      bytes32[33] calldata frontierPriorBlock, // frontier path before prior block is added. The same frontier used in calculating root when prior block is added
      Structures.Block memory blockL2,
      Structures.Transaction[] memory transactions,
      uint commitmentIndex // the index *in the Merkle Tree* of the commitment that we are providing a SiblingPath for.
    ) public pure {
    isBlockHashCorrect(priorBlockL2);
    isBlockHashCorrect(blockL2);
    uint nCommitmentsPriorBlock;
    for (uint i = 0; i < priorBlockTransactions.length; i++) {
      require(
        priorBlockL2.transactionHashes[i] == Utils.hashTransaction(priorBlockTransactions[i]),
        'Transaction hash was not found'
      );
      for (uint j = 0; j < priorBlockTransactions[i].commitments.length; j++){
        if (priorBlockTransactions[i].commitments[j] != ZERO) {
          nCommitmentsPriorBlock++; // remember how many commitments are in the block
        }
      }
    }

    //calculate the number of commitments in prior block
    bytes32[] memory commitmentsPriorBlock = new bytes32[](nCommitmentsPriorBlock);
    uint l;
    for (uint i = 0; i < priorBlockTransactions.length; i++) {
      for (uint j = 0; j < priorBlockTransactions[i].commitments.length; j++)
        if (priorBlockTransactions[i].commitments[j] != ZERO) {
          commitmentsPriorBlock[l++] = priorBlockTransactions[i].commitments[j];
        }
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
    function libChallengeNoDuplicateTransaction(
      Structures.Block memory block1,
      Structures.Block memory block2,
      uint transactionIndex1,
      uint transactionIndex2
    ) public pure {
      isBlockHashCorrect(block1);
      isBlockHashCorrect(block2);
      // Check if a duplicate transaction exists in these blocks
      require(block1.transactionHashes[transactionIndex1] == block2.transactionHashes[transactionIndex2],
        'There is no duplicate transaction in these blocks');
    }

    // the transaction type is challenged to not be valid
    function libChallengeTransactionType(
      Structures.Block memory blockL2,
      Structures.Transaction memory transaction,
      uint transactionIndex
    ) public pure {
      isBlockHashCorrect(blockL2);
      isTransactionValid(blockL2, transaction, transactionIndex);
      if(transaction.transactionType == Structures.TransactionTypes.DEPOSIT)
        libChallengeTransactionTypeDeposit(transaction);
        // TODO add these checks back after PR for out of gas
      else if(transaction.transactionType == Structures.TransactionTypes.SINGLE_TRANSFER)
        libChallengeTransactionTypeSingleTransfer(transaction);
      else if(transaction.transactionType == Structures.TransactionTypes.DOUBLE_TRANSFER)
        libChallengeTransactionTypeDoubleTransfer(transaction);
      else // if(transaction.transactionType == TransactionTypes.WITHDRAW)
        libChallengeTransactionTypeWithdraw(transaction);
    }

    // the transaction type deposit is challenged to not be valid
    function libChallengeTransactionTypeDeposit(
      Structures.Transaction memory transaction
    ) public pure {
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
        (transaction.tokenId == ZERO && transaction.value == 0) ||
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
    ) public pure {
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
        transaction.value != 0 ||
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
    ) public pure {
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
        transaction.value != 0 ||
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
    ) public pure {
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
        (transaction.tokenId == ZERO && transaction.value == 0) ||
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

    // the transaction type deposit is challenged to not be valid
    function libChallengePublicInputHash(
      Structures.Block memory blockL2,
      Structures.Transaction memory transaction,
      uint transactionIndex
    ) public pure {
      isBlockHashCorrect(blockL2);
      isTransactionValid(blockL2, transaction, transactionIndex);
      if(transaction.transactionType == Structures.TransactionTypes.DEPOSIT)
        libChallengePublicInputHashDeposit(transaction);
      else if(transaction.transactionType == Structures.TransactionTypes.SINGLE_TRANSFER)
        libChallengePublicInputHashSingleTransfer(transaction);
      else if(transaction.transactionType == Structures.TransactionTypes.DOUBLE_TRANSFER)
        libChallengePublicInputHashDoubleTransfer(transaction);
      else // if(transaction.transactionType == TransactionTypes.WITHDRAW)
        libChallengePublicInputHashWithdraw(transaction);
    }

    // the transaction type withdraw is challenged to not be valid
    function libChallengePublicInputHashDeposit(
      Structures.Transaction memory transaction
    ) public pure {
      require(
        transaction.publicInputHash != sha256(
          abi.encodePacked(transaction.ercAddress, transaction.tokenId, transaction.value, transaction.commitments)
      ) & 0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
      "publicInputHash for deposit is correct"
      );
    }

    // the transaction type withdraw is challenged to not be valid
    function libChallengePublicInputHashSingleTransfer(
      Structures.Transaction memory transaction
    ) public pure {
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
    ) public pure {
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
    ) public pure {
      require(
        transaction.publicInputHash != sha256(
          abi.encodePacked(transaction.ercAddress, transaction.tokenId, transaction.value, transaction.nullifiers, transaction.recipientAddress, transaction.historicRoot)
        ) & 0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, // select 248 bits of the sha256 calculated
        "publicInputHash for withdraw is correct"
      );
    }

    function libChallengeProofVerification(
      Structures.Block memory blockL2,
      Structures.Transaction memory transaction,
      uint transactionIndex,
      uint256[] memory vk
    ) internal {
      isBlockHashCorrect(blockL2);
      isTransactionValid(blockL2, transaction, transactionIndex);
      uint[] memory proof = new uint[](transaction.proof.length);
      for (uint i = 0; i < proof.length; i++){
        proof[i] = transaction.proof[i];
      }
      require(!Verifier.verify(
        proof,
        uint256(transaction.publicInputHash),
        vk),
        'This proof appears to be valid'
      );
    }

    function libChallengeNullifier(
      Structures.Block memory block1,
      Structures.Transaction memory tx1,
      uint transactionIndex1,
      uint nullifierIndex1,
      Structures.Block memory block2,
      Structures.Transaction memory tx2,
      uint transactionIndex2,
      uint nullifierIndex2
    ) public pure {
        require(tx1.nullifiers[nullifierIndex1] == tx2.nullifiers[nullifierIndex2], 'Not matching nullifiers' );
        require(Utils.hashTransaction(tx1) != Utils.hashTransaction(tx2), 'Transactions need to be different' );
        require(Utils.hashTransaction(tx1) == block1.transactionHashes[transactionIndex1], 'First Tx not in block' );
        require(Utils.hashTransaction(tx2) == block2.transactionHashes[transactionIndex2], 'Second Tx not in block' );
    }

    // Checks if a block has is calculated correctly
    function isBlockHashCorrect(Structures.Block memory b) public pure {
      require(b.blockHash == Utils.hashBlock(b), 'The block hash is incorrect');
    }

    // Checks if the block contains the transaction in the index specified and that the
    // transaction hash is correctly calculated
    function isTransactionValid(Structures.Block memory b, Structures.Transaction memory t, uint index) public pure {
      bytes32 transactionHash = Utils.hashTransaction(t);
      require(
        b.transactionHashes[index] == transactionHash,
        'Transaction hash was not found in the block'
      );
      require(
        Utils.hashTransaction(t) == transactionHash,
        'The transaction hash is incorrect'
      );
    }
}
