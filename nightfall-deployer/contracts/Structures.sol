// SPDX-License-Identifier: CC0
/*
Basic data structures for an optimistic rollup
*/

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

contract Structures {

  enum TransactionTypes { DEPOSIT, SINGLE_TRANSFER, DOUBLE_TRANSFER, WITHDRAW }

  event Rollback(
    bytes32 indexed root,
    uint leafCount
  );

  event BlockDeleted(bytes32 indexed blockHash);

  event BlockProposed();

  event TransactionSubmitted();

  event NewCurrentProposer(
    address proposer
  );

  event CommittedToChallenge(
    bytes32 commitHash,
    address sender
  );

  /**
  These events are what the merkle-tree microservice's filters will listen for.
  */
  event NewLeaf(uint leafIndex, bytes32 leafValue, bytes32 root);
  event NewLeaves(uint minLeafIndex, bytes32[] leafValues, bytes32 root);

  // a struct representing a generic transaction, some of these data items
  // will hold default values for any specific tranaction, e.g. there are no
  // nullifiers for a Deposit transaction.
  struct Transaction {
    uint64 value;
    uint64 blockNumberL2; // number of block containing historic root
    TransactionTypes transactionType;
    bytes32 publicInputHash;
    bytes32 tokenId;
    bytes32 ercAddress;
    bytes32 recipientAddress;
    bytes32[2] commitments;
    bytes32[2] nullifiers;
    uint[4] proof;
  }

  struct Block {
    address proposer;
    bytes32 root; // the 'output' commmitment root after adding all commitments
    uint64 leafCount;
    uint64 nCommitments;
    uint64 blockNumberL2;
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
    uint time; // time the block was created
  }

  struct LinkedAddress {
    address thisAddress;
    address previousAddress;
    address nextAddress;
  }

}
