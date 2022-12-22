// SPDX-License-Identifier: CC0
/*
Basic data structures for an optimistic rollup
*/

pragma solidity ^0.8.0;

contract Structures {
    error InvalidTransactionHash();
    error CommitmentNotEscrowed(bytes32 commitmentHash);
    error InvalidBlockSize();
    error InvalidTransactionSize();

    enum TokenType {
        ERC20,
        ERC721,
        ERC1155
    }

    event Rollback(uint64 blockNumberL2);

    event BlockProposed();

    event TransactionSubmitted();

    event NewCurrentProposer(address proposer);

    event CommittedToChallenge(bytes32 commitHash, address sender);

    event InstantWithdrawalRequested(
        bytes32 withdrawTransactionHash,
        address paidBy,
        uint256 amount
    );
    event ShieldBalanceTransferred(address ercAddress, uint256 amount);
    event NewBootProposerSet(address addr);
    event NewBootChallengerSet(address addr);

    /**
  These events are what the merkle-tree microservice's filters will listen for.
  */
    event NewLeaf(uint256 leafIndex, bytes32 leafValue, bytes32 root);
    event NewLeaves(uint256 minLeafIndex, bytes32[] leafValues, bytes32 root);

    // a struct representing a generic transaction, some of these data items
    // will hold default values for any specific tranaction, e.g. there are no
    // nullifiers for a Deposit transaction.
    struct Transaction {
        uint256 packedInfo;
        uint256[] historicRootBlockNumberL2;
        bytes32 tokenId;
        bytes32 ercAddress;
        bytes32 recipientAddress;
        bytes32[] commitments;
        bytes32[] nullifiers;
        bytes32[2] compressedSecrets;
        uint256[4] proof;
    }

    struct Block {
        uint256 packedInfo;
        bytes32 root; // the 'output' commmitment root after adding all commitments
        bytes32 previousBlockHash;
        bytes32 frontierHash;
        bytes32 transactionHashesRoot; // This variable needs to be the last one in order proposeBlock to work
    }

    struct BlockData {
        bytes32 blockHash; // hash of the block
        uint256 time; // time the block was created
        address proposer; //proposer of the block
        uint96 blockStake; //amount staked by the proposer for this block
    }

    struct LinkedAddress {
        address thisAddress;
        address previousAddress;
        address nextAddress;
        string url;
        uint256 fee;
        bool inProposerSet;
        uint256 indexProposerSet;
    }

    struct TimeLockedStake {
        uint112 amount; // The amount held
        uint112 challengeLocked; // The amount locked by block proposed still in CHALLENGE_PERIOD and not claimed
        uint32 time; // The time the funds were locked from
    }

    struct PublicInputs {
        uint256[] roots;
        address feeL2TokenAddress;
    }

    struct TransactionInfoBlock {
        Block blockL2;
        Transaction transaction;
        uint256 transactionIndex;
        bytes32[] transactionSiblingPath;
    }

    /**
     * @dev Element of the proposer set for next span
     */
    struct ProposerSet {
        address thisAddress;
        uint256 weight;
        int256 currentWeight;
        uint256 effectiveWeight;
    }

    struct AdvanceWithdrawal {
        address currentOwner;
        uint88 advanceFee;
        bool isWithdrawn;
    }

    struct BlockInfo {
        uint248 feesL2;
        bool stakeClaimed;
    }

    struct FeeTokens {
        uint256 feesL1;
        uint256 feesL2;
    }

    struct CircuitInfo {
        bool isWithdrawing;
        bool isEscrowRequired;
    }
}
