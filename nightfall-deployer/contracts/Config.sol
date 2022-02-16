// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.0;

contract Config {
  uint256 constant MINIMUM_STAKE = 10 wei; // TODO owner can update
  uint256 constant BLOCK_STAKE = 1 wei;
  uint256 constant ROTATE_PROPOSER_BLOCKS = 400;
  uint256 constant CHALLENGE_PERIOD = 1 weeks;
  bytes32 constant ZERO = bytes32(0);
  uint256 constant VALUE_PER_SLOT = 2; // amount of value of a slot
  uint256 constant PROPOSER_SET_COUNT = 5; // number of slots to pop after shuffling slots that will build the proposer set
  uint256 constant SPRINTS_IN_SPAN = 5; // number of sprints of a span
}
