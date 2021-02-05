// SPDX-License-Identifier: CC0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import './Structures.sol';
import './Ownable.sol';
import "./ERCInterface.sol";

contract Utils is Structures {

  function hashTransaction(Transaction memory t) internal pure returns(bytes32) {
    return keccak256(
      abi.encodePacked(
        t.fee,
        t.transactionType,
        t.publicInputHash,
        t.tokenId,
        t.value,
        t.ercAddress, // Take in as bytes32 for consistent hashing
        t.recipientAddress,
        t.commitments,
        t.nullifiers,
        t.historicRoot,
        t.proof
      )
    );
  }

  function hashBlock(Block memory b) internal pure returns(bytes32) {
    return keccak256(
      abi.encodePacked(
        b.proposer,
        b.transactionHashes,
        b.root
      )
    );
  }

  function removeBlockHashes(bytes32 blockHash) internal {
    bytes32 hash = blockHash;
    endHash = blockHashes[hash].previousHash;
    do {
      bytes32 nextHash = blockHashes[hash].nextHash;
      delete blockHashes[hash];
      hash = nextHash;
    } while(blockHashes[hash].nextHash != ZERO);
  }

  function removeProposer(address proposer) internal {
    address previousAddress = proposers[proposer].previousAddress;
    address nextAddress = proposers[proposer].nextAddress;
    delete proposers[proposer];
    proposers[previousAddress].nextAddress = proposers[nextAddress].thisAddress;
    proposers[nextAddress].previousAddress = proposers[previousAddress].thisAddress;
  }


  /* function isBlockReal(Block memory b) public view {
    require(b.blockHash == hashBlock(b), 'The block hash is incorrect');
    require(blockHashes[b.blockHash].thisHash == b.blockHash, 'This block does not exist');
  } */

  // Checks if a block has is calculated correctly
  function isBlockHashCorrect(Block memory b) public view {
    require(b.blockHash == hashBlock(b), 'The block hash is incorrect');
  }

  // Checks if a block is actually referenced in the queue of blocks waiting
  // to go into the Shield state (stops someone challenging with a non-existent
  // block)
  function isBlockReal(Block memory b) public view {
    require(blockHashes[b.blockHash].thisHash == b.blockHash, 'This block does not exist');
  }

  function payOut(Transaction memory t) internal {
  // Now pay out the value of the commitment
    ERCInterface tokenContract = ERCInterface(
      address(uint160(uint256(t.ercAddress)))
    );
    address recipientAddress = address(uint160(uint256(t.recipientAddress)));
    if (t.tokenId == ZERO && t.value == ZERO) // disallow this corner case
      revert("Zero-value tokens are not allowed");

    if (t.tokenId == ZERO) // must be an ERC20
      tokenContract.transferFrom(
        address(this),
        recipientAddress,
        uint256(t.value)
      );
    else if (t.value == ZERO) // must be ERC721
      tokenContract.safeTransferFrom(
        address(this),
        recipientAddress,
        uint256(t.tokenId),
        ''
      );
    else // must be an ERC1155
      tokenContract.safeTransferFrom(
        address(this),
        recipientAddress,
        uint256(t.tokenId),
        uint256(t.value),
        ''
      );
  }

  function payIn(Transaction memory t) internal {
    ERCInterface tokenContract = ERCInterface(
      address(uint160(uint256(t.ercAddress)))
    );
    if (t.tokenId == ZERO && t.value == ZERO) // disallow this corner case
      revert("Depositing zero-value tokens is not allowed");
    if (t.tokenId == ZERO) // must be an ERC20
      tokenContract.transferFrom(msg.sender, address(this), uint256(t.value));
    else if (t.value == ZERO) // must be ERC721
      tokenContract.safeTransferFrom(
        msg.sender,
        address(this),
        uint256(t.tokenId),
        ''
      );
    else // must be an ERC1155
      tokenContract.safeTransferFrom(
        msg.sender,
        address(this),
        uint256(t.tokenId),
        uint256(t.value),
        ''
      );
  }
}
