// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.0;

contract Config {
  uint256 constant MINIMUM_STAKE = 10 wei; // TODO owner can update
  uint256 constant BLOCK_STAKE = 1 wei;
  uint256 constant ROTATE_PROPOSER_BLOCKS = 4;
  uint256 constant CHALLENGE_PERIOD = 1 weeks;
  bytes32 constant ZERO = bytes32(0);
}
