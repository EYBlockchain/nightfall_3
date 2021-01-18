// SPDX-License-Identifier: CC0
/*
Basic data structures for an optimistic rollup
*/

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import './Config.sol';

contract Structures is Config {

  enum TransactionTypes { DEPOSIT, SINGLE_TRANSFER, DOUBLE_TRANSFER, WITHDRAW }

  event RejectedProposedBlock(
    bytes32 blockHash
  );

  event AcceptedProposedBlock(
    bytes32 blockHash
  );

  event BlockProposed(
    Block b
  );

  event TransactionSubmitted(
    Transaction t
  );

  /**
  These events are what the merkle-tree microservice's filters will listen for.
  */
  event NewLeaf(uint leafIndex, bytes32 leafValue, bytes32 root);
  event NewLeaves(uint minLeafIndex, bytes32[] leafValues, bytes32 root);

  mapping(bytes32 => LinkedHash) public blockHashes; //linked list of block hashes
  mapping(address => LinkedAddress) public proposers;
  mapping(address => uint) public pendingWithdrawals;

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
    bytes32 recipientAddress;
    bytes32[] commitments;
    bytes32[] nullifiers;
    bytes32 historicRoot; // the root (if any) used to create the proof
    uint[] proof;
  }

  struct Block {
    bytes32 blockHash;
    uint blockTime;
    address proposer;
    bytes32[] transactionHashes; // TODO this could be a merkle root
    bytes32 root; // the 'output' commmitment root after adding all commitments
  }

  struct LinkedHash {
    bytes32 thisHash;
    bytes32 previousHash;
    bytes32 nextHash;
  }

  struct LinkedAddress {
    address thisAddress;
    address previousAddress;
    address nextAddress;
  }

}
