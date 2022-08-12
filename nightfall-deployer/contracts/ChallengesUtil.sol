// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.0;

import './Utils.sol';
import './Verifier.sol';
import './MerkleTree_Stateless.sol';
import './Structures.sol';

library ChallengesUtil {
    bytes32 public constant ZERO =
        0x0000000000000000000000000000000000000000000000000000000000000000;
    uint256 public constant MAX31 = 2**249 - 1;
    uint256 public constant MAX20 = 2**161 - 1;
    uint256 public constant BN128_GROUP_ORDER =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

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
        bytes32 root;
        bytes32[33] memory _frontier;
        (root, _frontier, ) = MerkleTree_Stateless.insertLeaves(
            Utils.filterCommitments(priorBlockTransactions),
            frontierPriorBlock,
            priorBlockL2.leafCount
        );
        require(root == priorBlockL2.root, 'The sibling path is invalid');
        uint256 commitmentIndex =
            priorBlockL2.leafCount + Utils.filterCommitments(priorBlockTransactions).length;
        // At last, we can check if the root itself is correct!
        (root, , ) = MerkleTree_Stateless.insertLeaves(
            Utils.filterCommitments(transactions),
            _frontier,
            commitmentIndex
        );
        require(root != blockL2.root, 'The root is actually fine');
    }

    function libChallengeProofVerification(
        Structures.Transaction calldata transaction,
        Structures.PublicInputs memory extraPublicInputs,
        uint256[8] memory proof,
        uint256[] memory vk
    ) internal {
        libCheckCompressedProof(transaction.proof, proof);
        // TODO convert from uint[8] to uint[] - make unnecessary.
        uint256[] memory proof1 = new uint256[](proof.length);
        for (uint256 i = 0; i < proof.length; i++) {
            proof1[i] = proof[i];
        }
        uint256[] memory publicInputs =
            Utils.getPublicInputs(
                transaction,
                extraPublicInputs.roots,
                extraPublicInputs.maticAddress
            );
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

    function libCheckOverflows(
        Structures.Block calldata blockL2,
        Structures.Transaction calldata transaction
    ) public pure {
        require(uint256(transaction.ercAddress) <= MAX20, 'ERC address out of range');
        require(
            (transaction.transactionType != Structures.TransactionTypes.TRANSFER &&
                uint256(transaction.recipientAddress) <= MAX20) ||
                (transaction.transactionType == Structures.TransactionTypes.TRANSFER),
            'Recipient ERC address out of range'
        );
        require(uint256(blockL2.root) < BN128_GROUP_ORDER, 'root out of range');
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
}
