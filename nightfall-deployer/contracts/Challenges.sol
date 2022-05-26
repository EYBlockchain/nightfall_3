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
        // Now, we have an incorrect leafCount, but Timber relies on the leafCount
        // emitted by the rollback event to revert its commitment database, so we
        // need to correct the leafCount before we call challengeAccepted(...).
        // We'll do that by counting forwards from the prior block.
        blockL2.leafCount =
            priorBlockL2.leafCount +
            uint48(Utils.countCommitments(priorBlockTransactions));
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
  Checks that a tranasction has not been seen before (i.e. a duplicate). If the duplicate transaction
  occurs within the same block, there is an additional check to ensure they are not at the same index
  (i.e. a trivial duplicate).
  */
    function challengeNoDuplicateTransaction(
        Block memory block1,
        Block memory block2,
        Transaction[] memory transactions1,
        Transaction[] memory transactions2,
        uint256 transactionIndex1,
        uint256 transactionIndex2,
        bytes32 salt
    ) external onlyBootChallenger {
        checkCommit(msg.data);
        // first, check we have real, in-train, contiguous blocks
        state.areBlockAndTransactionsReal(block1, transactions1);
        state.areBlockAndTransactionsReal(block2, transactions2);
        // If the duplicate exists in the same block, the index cannot be the same
        if (block1.blockNumberL2 == block2.blockNumberL2)
            require(transactionIndex1 != transactionIndex2, 'Cannot be the same index');

        require(
            Utils.hashTransaction(transactions1[transactionIndex1]) ==
                Utils.hashTransaction(transactions2[transactionIndex2]),
            'Txns are not the same'
        );
        // Delete the latest block of the two
        if (block1.blockNumberL2 > block2.blockNumberL2) {
            challengeAccepted(block1);
        } else {
            challengeAccepted(block2);
        }
    }

    function challengeTransactionType(
        Block memory blockL2,
        Transaction[] memory transactions,
        uint256 transactionIndex,
        bytes32 salt
    ) external onlyBootChallenger {
        checkCommit(msg.data);
        state.areBlockAndTransactionsReal(blockL2, transactions);
        ChallengesUtil.libChallengeTransactionType(transactions[transactionIndex]);
        // Delete the latest block of the two
        challengeAccepted(blockL2);
    }

    // signature for deposit:
    function challengeProofVerification(
        Block memory blockL2,
        Transaction[] calldata transactions,
        uint256 transactionIndex,
        uint256[8] memory uncompressedProof,
        bytes32 salt
    ) external onlyBootChallenger {
        checkCommit(msg.data);
        state.areBlockAndTransactionsReal(blockL2, transactions);
        // first check the transaction and block do not overflow
        ChallengesUtil.libCheckOverflows(blockL2, transactions[transactionIndex]);
        // now we need to check that the proof is correct
        ChallengesUtil.libCheckCompressedProof(
            transactions[transactionIndex].proof,
            uncompressedProof
        );
        ChallengesUtil.libChallengeProofVerification(
            transactions[transactionIndex],
            [uint256(0), uint256(0)],
            uncompressedProof,
            vks[transactions[transactionIndex].transactionType]
        );
        challengeAccepted(blockL2);
    }

    // signature for single transfer/withdraw:
    function challengeProofVerification(
        Block memory blockL2,
        Transaction[] calldata transactions,
        uint256 transactionIndex,
        Block memory blockL2ContainingHistoricRoot,
        Transaction[] memory transactionsOfblockL2ContainingHistoricRoot,
        uint256[8] memory uncompressedProof,
        bytes32 salt
    ) external onlyBootChallenger {
        checkCommit(msg.data);
        state.areBlockAndTransactionsReal(blockL2, transactions);
        state.areBlockAndTransactionsReal(
            blockL2ContainingHistoricRoot,
            transactionsOfblockL2ContainingHistoricRoot
        );
        // check the historic root is in the block provided.
        require(
            transactions[transactionIndex].historicRootBlockNumberL2[0] ==
                blockL2ContainingHistoricRoot.blockNumberL2
        );
        // first check the transaction and block do not overflow
        ChallengesUtil.libCheckOverflows(blockL2, transactions[transactionIndex]);
        // now we need to check that the proof is correct
        ChallengesUtil.libCheckCompressedProof(
            transactions[transactionIndex].proof,
            uncompressedProof
        );
        ChallengesUtil.libChallengeProofVerification(
            transactions[transactionIndex],
            [uint256(blockL2ContainingHistoricRoot.root), uint256(0)],
            uncompressedProof,
            vks[transactions[transactionIndex].transactionType]
        );
        challengeAccepted(blockL2);
    }

    // signature for double transfer:
    function challengeProofVerification(
        Block memory blockL2,
        Transaction[] calldata transactions,
        uint256 transactionIndex,
        Block[2] calldata blockL2ContainingHistoricRoot,
        Transaction[] memory transactionsOfblockL2ContainingHistoricRoot,
        Transaction[] memory transactionsOfblockL2ContainingHistoricRoot2,
        uint256[8] memory uncompressedProof,
        bytes32 salt
    ) external onlyBootChallenger {
        checkCommit(msg.data);
        state.areBlockAndTransactionsReal(blockL2, transactions);
        state.areBlockAndTransactionsReal(
            blockL2ContainingHistoricRoot[0],
            transactionsOfblockL2ContainingHistoricRoot
        );
        state.areBlockAndTransactionsReal(
            blockL2ContainingHistoricRoot[1],
            transactionsOfblockL2ContainingHistoricRoot2
        );
        // check the historic roots are in the blocks provided.
        require(
            transactions[transactionIndex].historicRootBlockNumberL2[0] ==
                blockL2ContainingHistoricRoot[0].blockNumberL2 &&
                transactions[transactionIndex].historicRootBlockNumberL2[1] ==
                blockL2ContainingHistoricRoot[1].blockNumberL2,
            'Incorrect historic root block'
        );
        // first check the transaction and block do not overflow
        ChallengesUtil.libCheckOverflows(blockL2, transactions[transactionIndex]);
        // now we need to check that the proof is correct
        ChallengesUtil.libChallengeProofVerification(
            transactions[transactionIndex],
            [
                uint256(blockL2ContainingHistoricRoot[0].root),
                uint256(blockL2ContainingHistoricRoot[1].root)
            ],
            uncompressedProof,
            vks[transactions[transactionIndex].transactionType]
        );
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
        uint256 transactionIndex1,
        uint256 nullifierIndex1,
        Block memory block2,
        Transaction[] memory txs2,
        uint256 transactionIndex2,
        uint256 nullifierIndex2,
        bytes32 salt
    ) external onlyBootChallenger {
        checkCommit(msg.data);
        ChallengesUtil.libChallengeNullifier(
            txs1[transactionIndex1],
            nullifierIndex1,
            txs2[transactionIndex2],
            nullifierIndex2
        );
        state.areBlockAndTransactionsReal(block1, txs1);
        state.areBlockAndTransactionsReal(block2, txs2);

        // The blocks are different and we prune the later block of the two
        // as we have a block number, it's easy to see which is the latest.
        if (block1.blockNumberL2 < block2.blockNumberL2) {
            challengeAccepted(block2);
        } else {
            challengeAccepted(block1);
        }
    }

    /*
  This checks if the historic root blockNumberL2 provided is greater than the numbe of blocks on-chain.
  If the root stored in the block is itself invalid, that is challengeable by challengeNewRootCorrect.
  the indices for the same nullifier in two **different** transactions contained in two blocks (note it should also be ok for the blocks to be the same)
  */
    function challengeHistoricRoot(
        Block memory blockL2,
        Transaction[] memory transactions,
        uint256 transactionIndex,
        bytes32 salt
    ) external onlyBootChallenger {
        checkCommit(msg.data);
        state.areBlockAndTransactionsReal(blockL2, transactions);
        if (
            transactions[transactionIndex].transactionType ==
            Structures.TransactionTypes.DOUBLE_TRANSFER
        ) {
            require(
                state.getNumberOfL2Blocks() <
                    uint256(transactions[transactionIndex].historicRootBlockNumberL2[0]) ||
                    state.getNumberOfL2Blocks() <
                    uint256(transactions[transactionIndex].historicRootBlockNumberL2[1]),
                'Historic root exists'
            );
        } else if (
            transactions[transactionIndex].transactionType == Structures.TransactionTypes.DEPOSIT
        ) {
            require(
                uint256(transactions[transactionIndex].historicRootBlockNumberL2[0]) != 0 ||
                    uint256(transactions[transactionIndex].historicRootBlockNumberL2[1]) != 0,
                'Historic root exists'
            );
        } else {
            require(
                state.getNumberOfL2Blocks() <
                    uint256(transactions[transactionIndex].historicRootBlockNumberL2[0]) ||
                    uint256(transactions[transactionIndex].historicRootBlockNumberL2[1]) != 0,
                'Historic root exists'
            );
        }
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
        state.emitRollback(badBlock.blockNumberL2, badBlock.leafCount);
        // we need to remove the block that has been successfully
        // challenged from the linked list of blocks and all of the subsequent
        // blocks
        uint256 numRemoved = removeBlockHashes(badBlock.blockNumberL2);
        // remove the proposer and give the proposer's block stake to the challenger
        state.rewardChallenger(msg.sender, badBlock.proposer, numRemoved);

        // TODO repay the fees of the transactors and any escrowed funds held by the
        // Shield contract.
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
        // salt = 0; // not really required as salt is in msg.data but stops the unused variable compiler warning. Bit of a waste of gas though.
        require(committers[hash] == msg.sender, 'Commitment hash is invalid');
        delete committers[hash];
    }
}
