// SPDX-License-Identifier: CC0
/*
Basic data structures for an optimistic rollup
*/

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

contract Structures {

  enum TransactionTypes { DEPOSIT, SINGLE_TRANSFER, DOUBLE_TRANSFER, WITHDRAW }

  event Rollback(
    bytes32 root,
    uint leafCount
  );

  event BlockDeleted(bytes32 blockHash);

  event BlockProposed(
    Block block,
    Transaction[] transactions,
    uint currentLeafCount
  );

  event TransactionSubmitted(
    Transaction transaction
  );

  event NewCurrentProposer(
    address proposer
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
    bytes32 transactionHash;
    uint fee;
    TransactionTypes transactionType;
    bytes32 publicInputHash;
    bytes32 tokenId;
    bytes32 value;
    bytes32 ercAddress;
    bytes32 recipientAddress;
    bytes32[] commitments;
    bytes32[] nullifiers;
    bytes32 historicRoot; // the root (if any) used to create the proof
    uint[] proof;
  }

  struct Block {
    bytes32 blockHash;
    address proposer;
    bytes32[] transactionHashes; // TODO this could be a merkle root
    bytes32 root; // the 'output' commmitment root after adding all commitments
    uint leafCount;
  }

  struct LinkedHash {
    bytes32 thisHash;
    bytes32 previousHash;
    bytes32 nextHash;
    uint data; // metadata (currently holds the block time)
  }

  struct LinkedAddress {
    address thisAddress;
    address previousAddress;
    address nextAddress;
  }

}
