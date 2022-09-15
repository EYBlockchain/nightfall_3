// SPDX-License-Identifier: CC0
/*
Basic data structures for an optimistic rollup
*/

pragma solidity ^0.8.0;

contract Structures {
    enum TransactionTypes {
        DEPOSIT,
        TRANSFER,
        WITHDRAW,
        TOKENISE,
        MANUFACTURE
    }

    enum TokenType {
        ERC20,
        ERC721,
        ERC1155
    }

    event Rollback(uint256 blockNumberL2);

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
        uint112 value;
        uint112 fee;
        TransactionTypes transactionType;
        TokenType tokenType;
        uint64[50] historicRootBlockNumberL2;
        bytes32 tokenId;
        bytes32 ercAddress;
        bytes32 recipientAddress;
        bytes32[51] commitments;
        bytes32[50] nullifiers;
        bytes32[2] compressedSecrets;
        uint256[4] proof;
    }

    struct Block {
        uint48 leafCount; // note this is defined to be the number of leaves BEFORE the commitments in this block are added
        address proposer;
        bytes32 root; // the 'output' commmitment root after adding all commitments
        uint256 blockNumberL2;
        bytes32 previousBlockHash;
        bytes32 transactionHashesRoot;
    }

    struct BlockData {
        bytes32 blockHash; // hash of the block
        uint256 time; // time the block was created
    }

    struct LinkedAddress {
        address thisAddress;
        address previousAddress;
        address nextAddress;
        string url;
    }

    struct TimeLockedBond {
        uint256 amount; // The amount held
        uint256 time; // The time the funds were locked from
    }

    struct Fee {
        address proposer;
        uint256 blockNumberL2;
    }

    struct FeeTokens {
        uint256 feesEth;
        uint256 feesMatic;
    }

    struct PublicInputs {
        uint256[4] roots;
        address maticAddress;
    }

    struct CircuitInfo {
        uint16 numberNullifiers;
        uint16 numberCommitments;
    }
}
