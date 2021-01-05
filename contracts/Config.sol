// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.6.0;

contract Config {
  uint constant REGISTRATION_BOND = 10 ether; // TODO owner can update
  uint constant BLOCK_STAKE = 1 ether;
  uint constant ROTATE_PROPOSER_BLOCKS = 4;
}
