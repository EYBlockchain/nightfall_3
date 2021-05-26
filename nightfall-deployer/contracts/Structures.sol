// SPDX-License-Identifier: CC0
/*
Basic data structures for an optimistic rollup
*/

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

contract Structures {
    enum TransactionTypes {DEPOSIT, SINGLE_TRANSFER, DOUBLE_TRANSFER, WITHDRAW}

    event Rollback(bytes32 indexed blockHash, uint256 blockNumberL2, uint256 leafCount);

    event BlockProposed();

    event TransactionSubmitted();

    event NewCurrentProposer(address proposer);

    event CommittedToChallenge(bytes32 commitHash, address sender);

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
        uint64 historicRootBlockNumberL2; // number of L2 block containing historic root
        TransactionTypes transactionType;
        bytes32 publicInputHash;
        bytes32 tokenId;
        bytes32 ercAddress;
        bytes32 recipientAddress;
        bytes32[2] commitments;
        bytes32[2] nullifiers;
        uint256[4] proof;
    }

    struct Block {
        uint48 leafCount;
        uint48 nCommitments;
        address proposer;
        bytes32 root; // the 'output' commmitment root after adding all commitments
    }

    /*
  struct LinkedHash {
    bytes32 thisHash;
    bytes32 previousHash;
    bytes32 nextHash;
    uint data; // metadata (currently holds the block time)
  }
*/
    struct BlockData {
        bytes32 blockHash; // hash of the block
        uint256 time; // time the block was created
    }

    struct LinkedAddress {
        address thisAddress;
        address previousAddress;
        address nextAddress;
    }
}
