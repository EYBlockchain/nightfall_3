// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.0;

import './Utils.sol';
import './Verifier.sol';
import './MerkleTree_Stateless.sol';
import './Structures.sol';

library ChallengesUtil {
    bytes32 public constant ZERO =
        0x0000000000000000000000000000000000000000000000000000000000000000;

    function libChallengeLeafCountCorrect(
        Structures.Block memory priorBlockL2,
        Structures.Transaction[] memory priorBlockTransactions,
        uint256 leafCount
    ) public pure {
        uint256 expectedLeafCount =
            priorBlockL2.leafCount + Utils.countCommitments(priorBlockTransactions);
        require(expectedLeafCount != leafCount, 'The leafCount is actually correct');
    }

    function libChallengeNewRootCorrect(
        Structures.Block memory priorBlockL2, // the block immediately prior to this one
        Structures.Transaction[] memory priorBlockTransactions, // the transactions in the prior block
        bytes32[33] calldata frontierPriorBlock, // frontier path before prior block is added. The same frontier used in calculating root when prior block is added
        Structures.Block memory blockL2,
        Structures.Transaction[] memory transactions
    ) public pure {
        // next check the sibling path is valid and get the Frontier
        bool valid;
        bytes32[33] memory _frontier;
        (valid, _frontier) = MerkleTree_Stateless.checkPath(
            Utils.filterCommitments(priorBlockTransactions),
            frontierPriorBlock,
            priorBlockL2.leafCount,
            priorBlockL2.root
        );
        require(valid, 'The sibling path is invalid');
        uint256 commitmentIndex =
            priorBlockL2.leafCount + Utils.filterCommitments(priorBlockTransactions).length;
        // At last, we can check if the root itself is correct!
        (bytes32 root, , ) =
            MerkleTree_Stateless.insertLeaves(
                Utils.filterCommitments(transactions),
                _frontier,
                commitmentIndex
            );
        require(root != blockL2.root, 'The root is actually fine');
    }

    // the transaction type is challenged to not be valid
    function libChallengeTransactionType(Structures.Transaction memory transaction) public pure {
        if (transaction.transactionType == Structures.TransactionTypes.DEPOSIT)
            libChallengeTransactionTypeDeposit(transaction);
            // TODO add these checks back after PR for out of gas
        else if (transaction.transactionType == Structures.TransactionTypes.SINGLE_TRANSFER)
            libChallengeTransactionTypeSingleTransfer(transaction);
        else if (transaction.transactionType == Structures.TransactionTypes.DOUBLE_TRANSFER)
            libChallengeTransactionTypeDoubleTransfer(transaction); // if(transaction.transactionType == TransactionTypes.WITHDRAW)
        else libChallengeTransactionTypeWithdraw(transaction);
    }

    // the transaction type deposit is challenged to not be valid
    function libChallengeTransactionTypeDeposit(Structures.Transaction memory transaction)
        public
        pure
    {
        uint256 nZeroProof;
        for (uint256 i = 0; i < transaction.proof.length; i++) {
            if (transaction.proof[i] == 0) nZeroProof++;
        }
        uint256 nZeroCompressedSecrets;
        for (uint256 i = 0; i < transaction.compressedSecrets.length; i++) {
            if (transaction.compressedSecrets[i] == 0) nZeroCompressedSecrets++;
        }
        require(
            (transaction.tokenId == ZERO && transaction.value == 0) ||
                transaction.ercAddress == ZERO ||
                transaction.recipientAddress != ZERO ||
                transaction.commitments[0] == ZERO ||
                transaction.commitments[1] != ZERO ||
                transaction.nullifiers[0] != ZERO ||
                transaction.nullifiers[1] != ZERO ||
                nZeroCompressedSecrets != 8 ||
                nZeroProof == 4 || // We assume that 3 out of the 4 proof elements can be a valid ZERO. Deals with exception cases
                transaction.historicRootBlockNumberL2[0] != 0 ||
                transaction.historicRootBlockNumberL2[1] != 0,
            'This deposit transaction type is valid'
        );
    }

    // the transaction type single transfer is challenged to not be valid
    function libChallengeTransactionTypeSingleTransfer(Structures.Transaction memory transaction)
        public
        pure
    {
        uint256 nZeroCompressedSecrets;
        for (uint256 i = 0; i < transaction.compressedSecrets.length; i++) {
            if (transaction.compressedSecrets[i] == 0) nZeroCompressedSecrets++;
        }
        uint256 nZeroProof;
        for (uint256 i = 0; i < transaction.proof.length; i++) {
            if (transaction.proof[i] == 0) nZeroProof++;
        }
        require(
            transaction.tokenId != ZERO ||
                transaction.value != 0 ||
                transaction.ercAddress == ZERO ||
                transaction.recipientAddress != ZERO ||
                transaction.commitments[0] == ZERO ||
                transaction.commitments[1] != ZERO ||
                transaction.nullifiers[0] == ZERO ||
                transaction.nullifiers[1] != ZERO ||
                nZeroCompressedSecrets == 8 || // We assume that 7 out of the 8 compressed secrets elements can be a valid ZERO. Deals with exception cases
                nZeroProof == 4 || // We assume that 3 out of the 4 proof elements can be a valid ZERO. Deals with exception cases
                transaction.historicRootBlockNumberL2[1] != 0, // If this is a single, the second historicBlockNumber needs to be zero
            'This single transfer transaction type is valid'
        );
    }

    // the transaction type double transfer is challenged to not be valid
    function libChallengeTransactionTypeDoubleTransfer(Structures.Transaction memory transaction)
        public
        pure
    {
        uint256 nZeroCompressedSecrets;
        for (uint256 i = 0; i < transaction.compressedSecrets.length; i++) {
            if (transaction.compressedSecrets[i] == 0) nZeroCompressedSecrets++;
        }
        uint256 nZeroProof;
        for (uint256 i = 0; i < transaction.proof.length; i++) {
            if (transaction.proof[i] == 0) nZeroProof++;
        }
        require(
            transaction.tokenId != ZERO ||
                transaction.value != 0 ||
                transaction.ercAddress == ZERO ||
                transaction.recipientAddress != ZERO ||
                transaction.commitments[0] == ZERO ||
                transaction.commitments[1] == ZERO ||
                transaction.nullifiers[0] == ZERO ||
                transaction.nullifiers[1] == ZERO ||
                nZeroCompressedSecrets == 8 || // We assume that 7 out of the 8 compressed secrets elements can be a valid ZERO. Deals with exception cases
                nZeroProof == 4, // We assume that 3 out of the 4 proof elements can be a valid ZERO. Deals with exception cases
            'This double transfer transaction type is valid'
        );
    }

    // the transaction type withdraw is challenged to not be valid
    function libChallengeTransactionTypeWithdraw(Structures.Transaction memory transaction)
        public
        pure
    {
        uint256 nZeroProof;
        for (uint256 i = 0; i < transaction.proof.length; i++) {
            if (transaction.proof[i] == 0) nZeroProof++;
        }
        uint256 nZeroCompressedSecrets;
        for (uint256 i = 0; i < transaction.compressedSecrets.length; i++) {
            if (transaction.compressedSecrets[i] == 0) nZeroCompressedSecrets++;
        }
        require(
            (transaction.tokenId == ZERO && transaction.value == 0) ||
                transaction.ercAddress == ZERO ||
                transaction.recipientAddress == ZERO ||
                transaction.commitments[0] != ZERO ||
                transaction.commitments[1] != ZERO ||
                transaction.nullifiers[0] == ZERO ||
                transaction.nullifiers[1] != ZERO ||
                nZeroCompressedSecrets != 8 ||
                nZeroProof == 4 || // We assume that 3 out of the 4 proof elements can be a valid ZERO. Deals with exception cases
                transaction.historicRootBlockNumberL2[1] != 0, // A withdraw has a similar constraint as a single transfer
            'This withdraw transaction type is valid'
        );
    }

    function libChallengeProofVerification(
        Structures.Transaction calldata transaction,
        uint256[2] memory roots,
        uint256[8] memory proof,
        uint256[] memory vk
    ) internal {
        libCheckCompressedProof(transaction.proof, proof);
        // TODO convert from uint[8] to uint[] - make unnecessary.
        uint256[] memory proof1 = new uint256[](proof.length);
        for (uint256 i = 0; i < proof.length; i++) {
            proof1[i] = proof[i];
        }
        uint256[] memory publicInputs = Utils.getPublicInputs(transaction, roots);
        require(!Verifier.verify(proof1, publicInputs, vk), 'This proof appears to be valid');
    }

    function libCheckCompressedProof(
        uint256[4] memory compressedProof,
        uint256[8] memory uncompressedProof
    ) internal pure {
        // check equality by comparing hashes (cheaper than comparing elements)
        require(
            keccak256(abi.encodePacked(compressedProof)) ==
                keccak256(abi.encodePacked(Utils.compressProof(uncompressedProof))),
            'Cannot recreate compressed proof from uncompressed proof'
        );
    }

    function libChallengeNullifier(
        Structures.Transaction memory tx1,
        uint256 nullifierIndex1,
        Structures.Transaction memory tx2,
        uint256 nullifierIndex2
    ) public pure {
        require(
            tx1.nullifiers[nullifierIndex1] == tx2.nullifiers[nullifierIndex2],
            'Not matching nullifiers'
        );
        require(
            Utils.hashTransaction(tx1) != Utils.hashTransaction(tx2),
            'Transactions need to be different'
        );
    }

    function libChallengeTransactionHashesRoot(
        Structures.Block memory blockL2,
        Structures.Transaction[] memory transactions,
        bytes32 currentBlockHash
    ) public pure {
        bytes32 correctBlockHash =
            keccak256(
                abi.encode(
                    blockL2.leafCount,
                    blockL2.proposer,
                    blockL2.root,
                    blockL2.blockNumberL2,
                    blockL2.previousBlockHash,
                    Utils.hashTransactionHashes(transactions),
                    transactions
                )
            );
        require(correctBlockHash != currentBlockHash, 'txHashRoot incorrect');
    }
}
