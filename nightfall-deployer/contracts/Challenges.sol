// SPDX-License-Identifier: CC0-1.0

/**
Contract to enable someone to challenge a proposed transaction, on a number of
grounds.
@Author Westlad
*/

pragma solidity ^0.8.0;

import './Utils.sol';
import './ChallengesUtil.sol';
import './Config.sol';
import './Stateful.sol';

contract Challenges is Stateful, Config {
    mapping(bytes32 => address) public committers;

    function initialize() public override(Stateful, Config) initializer {
        Stateful.initialize();
        Config.initialize();
    }

    /**
  Check that the block correctly updates the leafCount.  Note that the leafCount
  is actually the value AFTER the commitments are added to the Merkle tree.
  */
    function challengeLeafCountCorrect(
        Block calldata priorBlockL2, // the block immediately prior to this one
        Block calldata blockL2,
        Transaction[] calldata transactions,
        bytes32 salt
    ) external {
        checkCommit(msg.data);
        // check if the block hash is correct and the block hash exists for the block and prior block. Also if the transactions are part of these block
        state.isBlockReal(priorBlockL2);
        state.areBlockAndTransactionsReal(blockL2, transactions);

        require(
            Utils.getBlockNumberL2(priorBlockL2.packedInfo) + 1 ==
                Utils.getBlockNumberL2(blockL2.packedInfo),
            'Blocks needs to be subsequent'
        );
        ChallengesUtil.libChallengeLeafCountCorrect(
            Utils.getLeafCount(priorBlockL2.packedInfo),
            Utils.getLeafCount(blockL2.packedInfo),
            transactions
        );
        challengeAccepted(blockL2);
    }

    function challengeNewFrontierCorrect(
        Block calldata priorBlockL2, // the block immediately prior to this one
        bytes32[33] calldata frontierBeforeBlock, // frontier path before prior block is added. The same frontier used in calculating root when prior block is added
        Block calldata blockL2,
        Transaction[] calldata transactions,
        bytes32 salt
    ) external {
        checkCommit(msg.data);
        // check if the block hash is correct and the block hash exists for the block and prior block
        state.isBlockReal(priorBlockL2);
        state.areBlockAndTransactionsReal(blockL2, transactions);

        require(
            Utils.getBlockNumberL2(priorBlockL2.packedInfo) + 1 ==
                Utils.getBlockNumberL2(blockL2.packedInfo),
            'Blocks needs to be subsequent'
        );

        bytes32 frontierBeforeHash = keccak256(abi.encodePacked(frontierBeforeBlock));
        require(frontierBeforeHash == priorBlockL2.frontierHash, 'Invalid prior block frontier');

        // see if the challenge is valid
        ChallengesUtil.libChallengeNewFrontierCorrect(frontierBeforeBlock, blockL2, transactions);
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
        bytes32[33] calldata frontierAfterBlock, // frontier after all the block commitments has been added.
        Block calldata blockL2,
        bytes32 salt
    ) external {
        checkCommit(msg.data);

        // check that the current block hash is correct
        state.isBlockReal(blockL2);

        bytes32 frontierAfterHash = Utils.hashFrontier(frontierAfterBlock);
        require(frontierAfterHash == blockL2.frontierHash, 'Invalid prior block frontier');

        // see if the challenge is valid
        ChallengesUtil.libChallengeNewRootCorrect(frontierAfterBlock, blockL2);
        challengeAccepted(blockL2);
    }

    /**
  Checks that a commitment has not been part of an L2 block before (i.e. a duplicate). If the duplicate commitment
  occurs within the same block, there is an additional check to ensure they are not at the same index
  (i.e. a trivial duplicate).
  */
    function challengeCommitment(
        TransactionInfoBlock calldata transaction1,
        TransactionInfoBlock calldata transaction2,
        uint256 commitment1Index,
        uint256 commitment2Index,
        bytes32 salt
    ) external {
        checkCommit(msg.data);

        // first, check we have real, in-train, contiguous blocks
        state.areBlockAndTransactionReal(
            transaction1.blockL2,
            transaction1.transaction,
            transaction1.transactionIndex,
            transaction1.transactionSiblingPath
        );
        state.areBlockAndTransactionReal(
            transaction2.blockL2,
            transaction2.transaction,
            transaction2.transactionIndex,
            transaction2.transactionSiblingPath
        );

        uint64 blockL2NumberTx1 = Utils.getBlockNumberL2(transaction1.blockL2.packedInfo);
        uint64 blockL2NumberTx2 = Utils.getBlockNumberL2(transaction2.blockL2.packedInfo);

        if (blockL2NumberTx1 == blockL2NumberTx2) {
            require(
                transaction1.transactionIndex != transaction2.transactionIndex,
                'Cannot be the same transactionIndex'
            );
        }

        ChallengesUtil.libChallengeCommitment(
            transaction1.transaction,
            commitment1Index,
            transaction2.transaction,
            commitment2Index
        );

        // Delete the latest block of the two
        if (blockL2NumberTx1 > blockL2NumberTx2) {
            challengeAccepted(transaction1.blockL2);
        } else {
            challengeAccepted(transaction2.blockL2);
        }
    }

    /**
  Checks that a nullifier has not been part of an L2 block before (i.e. a duplicate). If the duplicate nullifier
  occurs within the same block, there is an additional check to ensure they are not at the same index
  (i.e. a trivial duplicate).
  */
    function challengeNullifier(
        TransactionInfoBlock calldata transaction1,
        TransactionInfoBlock calldata transaction2,
        uint256 nullifier1Index,
        uint256 nullifier2Index,
        bytes32 salt
    ) external {
        checkCommit(msg.data);

        // first, check we have real, in-train, contiguous blocks
        state.areBlockAndTransactionReal(
            transaction1.blockL2,
            transaction1.transaction,
            transaction1.transactionIndex,
            transaction1.transactionSiblingPath
        );
        state.areBlockAndTransactionReal(
            transaction2.blockL2,
            transaction2.transaction,
            transaction2.transactionIndex,
            transaction2.transactionSiblingPath
        );

        uint64 blockL2NumberTx1 = Utils.getBlockNumberL2(transaction1.blockL2.packedInfo);
        uint64 blockL2NumberTx2 = Utils.getBlockNumberL2(transaction2.blockL2.packedInfo);

        if (blockL2NumberTx1 == blockL2NumberTx2) {
            require(
                transaction1.transactionIndex != transaction2.transactionIndex,
                'Cannot be the same transactionIndex'
            );
        }

        ChallengesUtil.libChallengeNullifier(
            transaction1.transaction,
            nullifier1Index,
            transaction2.transaction,
            nullifier2Index
        );

        // Delete the latest block of the two
        if (blockL2NumberTx1 > blockL2NumberTx2) {
            challengeAccepted(transaction1.blockL2);
        } else {
            challengeAccepted(transaction2.blockL2);
        }
    }

    function challengeProofVerification(
        TransactionInfoBlock calldata transaction,
        Block[] calldata blockL2ContainingHistoricRoot,
        uint256[8] memory uncompressedProof,
        bytes32 salt
    ) external {
        checkCommit(msg.data);
        state.areBlockAndTransactionReal(
            transaction.blockL2,
            transaction.transaction,
            transaction.transactionIndex,
            transaction.transactionSiblingPath
        );

        require(
            blockL2ContainingHistoricRoot.length == transaction.transaction.nullifiers.length,
            'Invalid number of blocks L2 containing historic root'
        );

        PublicInputs memory extraPublicInputs = PublicInputs(
            new uint256[](transaction.transaction.nullifiers.length),
            super.getMaticAddress()
        );

        for (uint256 i = 0; i < transaction.transaction.nullifiers.length; ++i) {
            if (uint256(transaction.transaction.nullifiers[i]) != 0) {
                state.isBlockReal(blockL2ContainingHistoricRoot[i]);

                uint64 historicblockNumberL2 = Utils.getHistoricRoot(
                    transaction.transaction.historicRootBlockNumberL2,
                    i
                );

                require(
                    historicblockNumberL2 ==
                        Utils.getBlockNumberL2(blockL2ContainingHistoricRoot[i].packedInfo),
                    'Incorrect historic root block'
                );

                extraPublicInputs.roots[i] = uint256(blockL2ContainingHistoricRoot[i].root);
            }
        }

        // now we need to check that the proof is correct
        ChallengesUtil.libChallengeProofVerification(
            transaction.transaction,
            extraPublicInputs,
            uncompressedProof,
            state.getVerificationKey(Utils.getCircuitHash(transaction.transaction.packedInfo))
        );
        challengeAccepted(transaction.blockL2);
    }

    function challengeHistoricRootBlockNumber(TransactionInfoBlock calldata transaction) external {
        checkCommit(msg.data);
        state.areBlockAndTransactionReal(
            transaction.blockL2,
            transaction.transaction,
            transaction.transactionIndex,
            transaction.transactionSiblingPath
        );

        for (uint256 i = 0; i < transaction.transaction.nullifiers.length; ++i) {
            uint64 historicblockNumberL2 = Utils.getHistoricRoot(
                transaction.transaction.historicRootBlockNumberL2,
                i
            );

            if (uint256(historicblockNumberL2) >= state.getNumberOfL2Blocks()) {
                challengeAccepted(transaction.blockL2);
                return;
            }
        }

        require(false, 'Historic roots are not greater than L2BlockNumber on chain');
    }

    // This gets called when a challenge succeeds
    function challengeAccepted(Block calldata badBlock) private {
        // Check to ensure that the block being challenged is less than a week old
        uint64 blockNumberL2 = Utils.getBlockNumberL2(badBlock.packedInfo);
        require(
            state.getBlockData(blockNumberL2).time >= (block.timestamp - 7 days),
            'Cannot challenge block'
        );
        // emit the leafCount where the bad block was added. Timber will pick this
        // up and rollback its database to that point.  We emit the event from
        // State.sol because Timber gets confused if its events come from two
        // different contracts (it uses the contract name as part of the db
        // connection - we need to change that).
        emit Rollback(blockNumberL2);
        // we need to remove the block that has been successfully
        // challenged from the linked list of blocks and all of the subsequent
        // blocks
        BlockData[] memory badBlocks = removeBlockHashes(blockNumberL2);
        // remove the proposer and give the proposer's block stake to the challenger
        state.rewardChallenger(msg.sender, Utils.getProposer(badBlock.packedInfo), badBlocks);
    }

    function removeBlockHashes(uint64 blockNumberL2) internal returns (BlockData[] memory) {
        uint256 lastBlock = state.getNumberOfL2Blocks() - 1;
        BlockData[] memory badBlocks = new BlockData[](lastBlock - blockNumberL2 + 1);
        for (uint256 i = 0; i <= uint256(lastBlock - blockNumberL2); i++) {
            BlockData memory blockData = state.popBlockData();
            state.setBlockStakeWithdrawn(blockData.blockHash);
            badBlocks[i] = blockData;
        }
        require(
            state.getNumberOfL2Blocks() == uint256(blockNumberL2),
            'Number remaining not as expected.'
        );
        return badBlocks;
    }

    //To prevent frontrunning, we need to commit to a challenge before we send it
    function commitToChallenge(bytes32 commitHash) external {
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
