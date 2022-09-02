// SPDX-License-Identifier: CC0-1.0

/**
Contract to enable someone to challenge a proposed transaction, on a number of
grounds.
@Author Westlad
*/

pragma solidity ^0.8.0;

import './Key_Registry.sol';
import './Utils.sol';
import './ChallengesUtil.sol';
import './Config.sol';
import './Stateful.sol';

contract Challenges is Stateful, Key_Registry, Config {
    mapping(bytes32 => address) public committers;

    function initialize() public override(Stateful, Key_Registry, Config) initializer {
        Stateful.initialize();
        Key_Registry.initialize();
        Config.initialize();
    }

    /**
  Check that the block correctly updates the leafCount.  Note that the leafCount
  is actually the value BEFORE the commitments are added to the Merkle tree.
  Thus we need the prior block so that we can check it because the value should
  be the prior block leafcount plus the number of non-zero commitments in the
  prior block.
  */
    function challengeLeafCountCorrect(
        Block memory priorBlockL2, // the block immediately prior to this one
        Transaction[] memory priorBlockTransactions, // the transactions in the prior block
        Block memory blockL2,
        Transaction[] memory transactions,
        bytes32 salt
    ) external onlyBootChallenger {
        checkCommit(msg.data);
        // check if the block hash is correct and the block hash exists for the block and prior block. Also if the transactions are part of these block
        state.areBlockAndTransactionsReal(priorBlockL2, priorBlockTransactions);
        state.areBlockAndTransactionsReal(blockL2, transactions);
        ChallengesUtil.libChallengeLeafCountCorrect(
            priorBlockL2,
            priorBlockTransactions,
            blockL2.leafCount
        );
        challengeAccepted(blockL2);
    }

    /**
  Checks that the new merkle tree root of a block is incorrect. This could be because the
  merkle tree that stores commitments has been incorrectly updated. To verify this, we first calculate
  this challenged block's frontier using the prior block. Using this frontier, we can work out what the root
  for the current block should be given the set of transactions in said block. Finally, this calculated root
  is compared to the root stored within the block.
  */
    function challengeNewRootCorrect(
        Block memory priorBlockL2, // the block immediately prior to this one
        Transaction[] memory priorBlockTransactions, // the transactions in the prior block
        bytes32[33] calldata frontierPriorBlock, // frontier path before prior block is added. The same frontier used in calculating root when prior block is added
        Block memory blockL2,
        Transaction[] memory transactions,
        bytes32 salt
    ) external onlyBootChallenger {
        checkCommit(msg.data);
        // check if the block hash is correct and the block hash exists for the block and prior block
        state.areBlockAndTransactionsReal(priorBlockL2, priorBlockTransactions);
        state.areBlockAndTransactionsReal(blockL2, transactions);
        // see if the challenge is valid
        ChallengesUtil.libChallengeNewRootCorrect(
            priorBlockL2,
            priorBlockTransactions,
            frontierPriorBlock,
            blockL2,
            transactions
        );
        challengeAccepted(blockL2);
    }

    /**
  Checks that a commitment has not been part of an L2 block before (i.e. a duplicate). If the duplicate commitment
  occurs within the same block, there is an additional check to ensure they are not at the same index
  (i.e. a trivial duplicate).
  */
    function challengeCommitment(
        Block memory block1,
        Block memory block2,
        Transaction[] memory transactions1,
        Transaction[] memory transactions2,
        uint256 transaction1Index,
        uint256 transaction2Index,
        uint256 commitment1Index,
        uint256 commitment2Index,
        bytes32 salt
    ) external onlyBootChallenger {
        checkCommit(msg.data);
        ChallengesUtil.libChallengeCommitment(
            transactions1[transaction1Index],
            commitment1Index,
            transactions2[transaction2Index],
            commitment2Index
        );
        // If the duplicate exists in the same block, the index cannot be the same
        if (block1.blockNumberL2 == block2.blockNumberL2)
            require(transaction1Index != transaction2Index, 'Cannot be the same index');
        // first, check we have real, in-train, contiguous blocks
        state.areBlockAndTransactionsReal(block1, transactions1);
        state.areBlockAndTransactionsReal(block2, transactions2);
        // Delete the latest block of the two
        if (block1.blockNumberL2 > block2.blockNumberL2) {
            challengeAccepted(block1);
        } else {
            challengeAccepted(block2);
        }
    }

    /**
  Checks that a nullifier has not been part of an L2 block before (i.e. a duplicate). If the duplicate nullifier
  occurs within the same block, there is an additional check to ensure they are not at the same index
  (i.e. a trivial duplicate).
  */
    function challengeNullifier(
        Block memory block1,
        Block memory block2,
        Transaction[] memory transactions1,
        Transaction[] memory transactions2,
        uint256 transaction1Index,
        uint256 transaction2Index,
        uint256 nullifier1Index,
        uint256 nullifier2Index,
        bytes32 salt
    ) external onlyBootChallenger {
        checkCommit(msg.data);
        ChallengesUtil.libChallengeNullifier(
            transactions1[transaction1Index],
            nullifier1Index,
            transactions2[transaction2Index],
            nullifier2Index
        );
        // If the duplicate exists in the same block, the index cannot be the same
        if (block1.blockNumberL2 == block2.blockNumberL2)
            require(transaction1Index != transaction2Index, 'Cannot be the same index');
        // first, check we have real, in-train, contiguous blocks
        state.areBlockAndTransactionsReal(block1, transactions1);
        state.areBlockAndTransactionsReal(block2, transactions2);
        // Delete the latest block of the two
        if (block1.blockNumberL2 > block2.blockNumberL2) {
            challengeAccepted(block1);
        } else {
            challengeAccepted(block2);
        }
    }

    function challengeProofVerification(
        Block memory blockL2,
        Transaction[] calldata transactions,
        uint256 transactionIndex,
        Block[4] calldata blockL2ContainingHistoricRoot,
        Transaction[][4] memory transactionsOfblockL2ContainingHistoricRoot,
        uint256[8] memory uncompressedProof,
        bytes32 salt
    ) external onlyBootChallenger {
        checkCommit(msg.data);
        state.areBlockAndTransactionsReal(blockL2, transactions);

        PublicInputs memory extraPublicInputs = PublicInputs(
            [uint256(0), 0, 0, 0],
            super.getMaticAddress()
        );

        if (uint256(transactions[transactionIndex].nullifiers[0]) != 0) {
            state.areBlockAndTransactionsReal(
                blockL2ContainingHistoricRoot[0],
                transactionsOfblockL2ContainingHistoricRoot[0]
            );
            require(
                transactions[transactionIndex].historicRootBlockNumberL2[0] ==
                    blockL2ContainingHistoricRoot[0].blockNumberL2,
                'Incorrect historic root block'
            );
            extraPublicInputs.roots[0] = uint256(blockL2ContainingHistoricRoot[0].root);
        }

        if (uint256(transactions[transactionIndex].nullifiers[1]) != 0) {
            state.areBlockAndTransactionsReal(
                blockL2ContainingHistoricRoot[1],
                transactionsOfblockL2ContainingHistoricRoot[1]
            );
            require(
                transactions[transactionIndex].historicRootBlockNumberL2[1] ==
                    blockL2ContainingHistoricRoot[1].blockNumberL2,
                'Incorrect historic root block'
            );
            extraPublicInputs.roots[1] = uint256(blockL2ContainingHistoricRoot[1].root);
        }

        if (uint256(transactions[transactionIndex].nullifiers[2]) != 0) {
            state.areBlockAndTransactionsReal(
                blockL2ContainingHistoricRoot[2],
                transactionsOfblockL2ContainingHistoricRoot[2]
            );
            require(
                transactions[transactionIndex].historicRootBlockNumberL2[2] ==
                    blockL2ContainingHistoricRoot[2].blockNumberL2,
                'Incorrect historic root block'
            );
            extraPublicInputs.roots[2] = uint256(blockL2ContainingHistoricRoot[2].root);
        }

        if (uint256(transactions[transactionIndex].nullifiers[3]) != 0) {
            state.areBlockAndTransactionsReal(
                blockL2ContainingHistoricRoot[3],
                transactionsOfblockL2ContainingHistoricRoot[3]
            );
            require(
                transactions[transactionIndex].historicRootBlockNumberL2[3] ==
                    blockL2ContainingHistoricRoot[3].blockNumberL2,
                'Incorrect historic root block'
            );
            extraPublicInputs.roots[3] = uint256(blockL2ContainingHistoricRoot[3].root);
        }

        // now we need to check that the proof is correct
        ChallengesUtil.libChallengeProofVerification(
            transactions[transactionIndex],
            extraPublicInputs,
            uncompressedProof,
            vks[transactions[transactionIndex].transactionType]
        );
        challengeAccepted(blockL2);
    }

    // This gets called when a challenge succeeds
    function challengeAccepted(Block memory badBlock) private {
        // Check to ensure that the block being challenged is less than a week old
        require(
            state.getBlockData(badBlock.blockNumberL2).time >= (block.timestamp - 7 days),
            'Cannot challenge block'
        );
        // emit the leafCount where the bad block was added. Timber will pick this
        // up and rollback its database to that point.  We emit the event from
        // State.sol because Timber gets confused if its events come from two
        // different contracts (it uses the contract name as part of the db
        // connection - we need to change that).
        state.emitRollback(badBlock.blockNumberL2);
        // we need to remove the block that has been successfully
        // challenged from the linked list of blocks and all of the subsequent
        // blocks
        uint256 numRemoved = removeBlockHashes(badBlock.blockNumberL2);
        // remove the proposer and give the proposer's block stake to the challenger
        state.rewardChallenger(msg.sender, badBlock.proposer, numRemoved);
    }

    function removeBlockHashes(uint256 blockNumberL2) internal returns (uint256) {
        uint256 lastBlock = state.getNumberOfL2Blocks() - 1;
        for (uint256 i = lastBlock; i >= blockNumberL2; i--) {
            state.setBlockStakeWithdrawn(state.popBlockData().blockHash);
        }
        require(state.getNumberOfL2Blocks() == blockNumberL2, 'Number remaining not as expected.');
        return (lastBlock + 1 - blockNumberL2);
    }

    //To prevent frontrunning, we need to commit to a challenge before we send it
    function commitToChallenge(bytes32 commitHash) external onlyBootChallenger {
        require(committers[commitHash] == address(0), 'Hash already committed to');
        committers[commitHash] = msg.sender;
        emit CommittedToChallenge(commitHash, msg.sender);
    }

    // and having sent it, we need to check that commitment to a challenge from
    // within the challenge function using this function:
    function checkCommit(bytes calldata messageData) private {
        bytes32 hash = keccak256(messageData);
        require(committers[hash] == msg.sender, 'Commitment hash is invalid');
        delete committers[hash];
    }
}
