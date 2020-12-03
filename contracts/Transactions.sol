// SPDX-License-Identifier: CC0
/*
Contract to manage the creation and managment of Transaction requests
*/

pragma solidity ^0.6.0;
contract Transactions {

  struct Transaction {
    uint transactionNonce;
    uint fee;
    TransactionTypes transactionType;
    TransactionStates transactionState;
    bytes32 publicInputHash;
    bytes32 root;
    bytes32 tokenId;
    bytes32 value;
    bytes32 ercAddress;
    bytes32[] commitments;
    bytes32[] nullifiers;
    bytes32 recipientAddress;
    uint[] proof;
  }
  // event is split into two because otherwise we get a Stack Too Deep error
  event OptimisticTransactionHeader(
    uint transactionNonce,
    uint fee,
    TransactionTypes transactionType,
    TransactionStates transactionState
  );

  event OptimisticTransactionBody(
    uint transactionNonce,
    bytes32 publicInputHash,
    bytes32 root,
    bytes32 tokenId,
    bytes32 value,
    bytes32 ercAddress,
    bytes32[] commitments,
    bytes32[] nullifiers,
    bytes32 recipientAddress,
    uint256[] proof
  );

  uint public transactionNonce; // transaction nonce for ease of reference
  mapping(uint => Transaction) public transactions;

  enum TransactionStates { PENDING, PROPOSED, ACCEPTED, REJECTED }
  enum TransactionTypes { DEPOSIT, SINGLE_TRANSFER, DOUBLE_TRANSFER, WITHDRAW }

}
