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

  function compressG1(uint x, uint y) internal pure returns(uint) {
    // compute whether y is odd or even and multiply by 2**255
    uint parity = 0x8000000000000000000000000000000000000000000000000000000000000000 * (y % 2);
    // add the parity bit to the x cordinate (x,y are 254 bits long - the final
    // number is 256 bits to fit with an Ethereum word)
    return parity + x;
  }

  function compressG2(uint xr, uint xi, uint yr, uint yi) internal pure returns(uint, uint) {
    return (compressG1(xr, yr), compressG1(xi, yi));
  }

  function compressProof(uint[8] memory proof) internal pure returns(uint[4] memory) {
    uint a = compressG1(proof[0], proof[1]);
    (uint rb, uint ib) = compressG2(proof[2], proof[3], proof[4], proof[5]);
    uint c = compressG1(proof[6], proof[7]);
    return [ a, rb, ib, c];
  }
}
