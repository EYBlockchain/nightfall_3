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
        b.transactionHashes,
        b.root,
        b.rootAccumulator,
        b.nullifierAccumulator
      )
    );
  }

  function removeBlockHash(bytes32 blockHash) internal {
    bytes32 previousHash = blockHashes[blockHash].previousHash;
    bytes32 nextHash = blockHashes[blockHash].nextHash;
    delete blockHashes[blockHash];
    blockHashes[previousHash].nextHash = blockHashes[nextHash].thisHash;
    blockHashes[nextHash].previousHash = blockHashes[previousHash].thisHash;
  }

  function removeProposer(address proposer) internal {
    address previousAddress = proposers[proposer].previousAddress;
    address nextAddress = proposers[proposer].nextAddress;
    delete proposers[proposer];
    proposers[previousAddress].nextAddress = proposers[nextAddress].thisAddress;
    proposers[nextAddress].previousAddress = proposers[previousAddress].thisAddress;
  }

  // Checks if a block is actually referenced in the queue of blocks waiting
  // to go into the Shield state (stops someone challenging with a non-existent
  // block).
  function isBlockReal(Block memory b) public view {
    require(b.blockHash == hashBlock(b), 'The block hash is incorrect');
    require(blockHashes[b.blockHash].thisHash == b.blockHash, 'This block does not exist');
  }

}
