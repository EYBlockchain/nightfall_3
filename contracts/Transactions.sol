// SPDX-License-Identifier: CC0
/*
Contract to manage the creation and managment of Transaction requests
*/

pragma solidity ^0.6.0;
contract Transactions {

  struct DepositTransaction {
    bytes32 transactionHash;
    uint fee;
    bytes32 publicInputHash;
    bytes32 tokenId;
    bytes32 value;
    bytes32 ercAddress;
    bytes32 commitment;
    uint[] proof;
  }
  // event is split into two because otherwise we get a Stack Too Deep error
  event DepositTransactionCreated(
    bytes32 transactionHash,
    uint fee,
    bytes32 publicInputHash,
    bytes32 tokenId,
    bytes32 value,
    bytes32 ercAddress,
    bytes32 commitment,
    uint[] proof
  );

  mapping(bytes32 => bool) public transactionHashes;

}
