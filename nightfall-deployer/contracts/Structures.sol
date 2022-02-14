// SPDX-License-Identifier: CC0
/*
Basic data structures for an optimistic rollup
*/

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

contract Structures {
    enum TransactionTypes {DEPOSIT, SINGLE_TRANSFER, DOUBLE_TRANSFER, WITHDRAW}

    enum TokenType {ERC20, ERC721, ERC1155}

    event Rollback(bytes32 indexed blockHash, uint256 blockNumberL2, uint256 leafCount);

    event BlockProposed();

    event TransactionSubmitted();

    event NewCurrentProposer(address proposer);

    event CommittedToChallenge(bytes32 commitHash, address sender);

    event InstantWithdrawalRequested(bytes32 withdrawTransactionHash, address paidBy, uint256 amount);

    /**
  These events are what the merkle-tree microservice's filters will listen for.
  */
    event NewLeaf(uint256 leafIndex, bytes32 leafValue, bytes32 root);
    event NewLeaves(uint256 minLeafIndex, bytes32[] leafValues, bytes32 root);

    // a struct representing a generic transaction, some of these data items
    // will hold default values for any specific tranaction, e.g. there are no
    // nullifiers for a Deposit transaction.
    struct Transaction {
        uint64 value;
        uint64[2] historicRootBlockNumberL2; // number of L2 block containing historic root
        TransactionTypes transactionType;
        TokenType tokenType;
        bytes32 tokenId;
        bytes32 ercAddress;
        bytes32 recipientAddress;
        bytes32[2] commitments;
        bytes32[2] nullifiers;
        bytes32[8] compressedSecrets;
        uint256[4] proof;
    }

  struct Block {
    uint48 leafCount; // note this is defined to be the number of leaves BEFORE the commitments in this block are added
    address proposer;
    bytes32 root; // the 'output' commmitment root after adding all commitments
    uint256 blockNumberL2;
    bytes32 previousBlockHash;
  }

  struct BlockData {
    bytes32 blockHash; // hash of the block
    uint256 time; // time the block was created
  }

    struct LinkedAddress {
        address thisAddress;
        address previousAddress;
        address nextAddress;
    }

    struct TimeLockedStake {
        uint256 amount; // The amount held
        uint256 challengeLocked; // The amount locked by block proposed still in CHALLENGE_PERIOD and not claimed
        uint256 time; // The time the funds were locked from
    }
}
