// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.0;

contract Config {
  uint constant REGISTRATION_BOND = 10 ether; // TODO owner can update
  uint constant BLOCK_STAKE = 1 ether;
  uint constant ROTATE_PROPOSER_BLOCKS = 4;
  uint constant COOLING_OFF_PERIOD = 1 weeks;
  bytes32 constant ZERO = bytes32(0);
}
