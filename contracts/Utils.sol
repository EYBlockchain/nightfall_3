// SPDX-License-Identifier: CC0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import './Structures.sol';
import './Ownable.sol';

contract Utils is Structures {

  function hashTransaction(Transaction memory t) internal pure returns(bytes32) {
    return sha256(
      abi.encodePacked(
        t.fee,
        t.transactionType,
        t.publicInputHash,
        t.tokenId,
        t.value,
        t.ercAddress, // Take in as bytes32 for consistent hashing
        t.commitments,
        t.nullifiers,
        t.historicRoot,
        t.proof
      )
    );
  }

  function hashBlock(Block memory b) internal pure returns(bytes32) {
    return sha256(
      abi.encodePacked(
        b.blockNonce,
        b.transactionHashes,
        b.root,
        b.rootAccumulator,
        b.nullifierAccumulator
      )
    );
  }
}
