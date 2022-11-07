// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.0;

import './Utils.sol';
import './Verifier.sol';
import './MerkleTree_Stateless.sol';
import './Structures.sol';

library ChallengesUtil {
    function libChallengeLeafCountCorrect(
        uint256 priorLeafCount,
        uint256 leafCount,
        Structures.Transaction[] calldata transactions
    ) public pure {
        uint256 expectedLeafCount = priorLeafCount + Utils.countCommitments(transactions);
        require(expectedLeafCount != leafCount, 'The leafCount is actually correct');
    }

    function libChallengeNewFrontierCorrect(
        bytes32[33] calldata frontierBeforeBlock, // frontier path before prior block is added. The same frontier used in calculating root when prior block is added
        Structures.Block calldata blockL2,
        Structures.Transaction[] calldata transactions
    ) public {
        bytes32[33] memory _frontier;

        _frontier = MerkleTree_Stateless.updateFrontier(
            Utils.filterCommitments(transactions),
            frontierBeforeBlock,
            Utils.getLeafCount(blockL2.packedInfo)
        );

        bytes32 frontierAfterHash = keccak256(abi.encodePacked(_frontier));
        require(frontierAfterHash != blockL2.frontierHash, 'The frontier is actually fine');
    }

    function libChallengeNewRootCorrect(
        bytes32[33] calldata frontierAfterBlock, // frontier path before prior block is added. The same frontier used in calculating root when prior block is added
        Structures.Block calldata blockL2
    ) public {
        bytes32 root = MerkleTree_Stateless.calculateRoot(frontierAfterBlock, Utils.getLeafCount(blockL2.packedInfo));

        require(root != blockL2.root, 'The root is actually fine');
    }

    function libChallengeProofVerification(
        Structures.Transaction calldata transaction,
        Structures.PublicInputs memory extraPublicInputs,
        uint256[8] memory proof,
        uint256[] memory vk
    ) internal {
        libCheckCompressedProof(transaction.proof, proof);
        uint256[] memory proof1 = new uint256[](proof.length);
        for (uint256 i = 0; i < proof.length; i++) {
            proof1[i] = proof[i];
        }
        uint256[] memory publicInputs = Utils.getPublicInputs(
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

    function libChallengeCommitment(
        Structures.Transaction calldata tx1,
        uint256 commitmentIndex1,
        Structures.Transaction calldata tx2,
        uint256 commitmentIndex2
    ) public pure {
        require(
            tx1.commitments[commitmentIndex1] != 0 &&
                tx1.commitments[commitmentIndex1] == tx2.commitments[commitmentIndex2],
            'Not matching commitments'
        );
    }

    function libChallengeNullifier(
        Structures.Transaction calldata tx1,
        uint256 nullifierIndex1,
        Structures.Transaction calldata tx2,
        uint256 nullifierIndex2
    ) public pure {
        require(
            tx1.nullifiers[nullifierIndex1] != 0 &&
                tx1.nullifiers[nullifierIndex1] == tx2.nullifiers[nullifierIndex2],
            'Not matching nullifiers'
        );
    }
}
