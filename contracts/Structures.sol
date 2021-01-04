// SPDX-License-Identifier: CC0
/*
Basic data structures for an optimistic rollup
*/

pragma solidity ^0.6.0;

contract Structures {

  enum TransactionTypes { DEPOSIT, SINGLE_TRANSFER, DOUBLE_TRANSFER, WITHDRAW }

  mapping(bytes32 => LinkedHash) public blockHashes; //linked list of block hashes
  bytes32 endHash; // holds the hash at the end of the linked list of block hashes, so that we can pick up the end.

  // a struct representing a generic transaction, some of these data items
  // will hold default values for any specific tranaction, e.g. there are no
  // nullifiers for a Deposit transaction.
  struct Transaction {
    bytes32 transactionHash;
    uint fee;
    TransactionTypes transactionType;
    bytes32 publicInputHash;
    bytes32 tokenId;
    bytes32 value;
    bytes32 ercAddress;
    bytes32[] commitments;
    bytes32[] nullifiers;
    bytes32 historicRoot; // the root (if any) used to create the proof
    uint[] proof;
  }

  struct Block {
    bytes32 blockHash;
    address proposer;
    bytes32[] transactionHashes;
    bytes32 root;
    bytes32 rootAccumulator;
    bytes32 nullifierAccumulator;
  }

  struct LinkedHash {
    bytes32 hash;
    bytes32 previousHash;
    bytes32 nextHash;
  }

  struct LinkedProposer {
    address proposer;
    address lastProposer;
    address nextProposer;
  }

}
