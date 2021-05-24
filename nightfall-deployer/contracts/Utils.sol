// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import './Structures.sol';

library Utils {

  function hashTransaction(Structures.Transaction memory t) internal pure returns(bytes32) {
    return keccak256(
      abi.encodePacked(
        t.value,
        t.transactionType,
        t.publicInputHash,
        t.tokenId,
        t.ercAddress, // Take in as bytes32 for consistent hashing
        t.recipientAddress,
        t.commitments,
        t.nullifiers,
        t.historicRoot,
        t.proof
      )
    );
  }

  function hashBlock(Structures.Block memory b, Structures.Transaction[] memory t) internal pure returns(bytes32) {
    return keccak256(abi.encode(b, t));
  }
}
