// SPDX-License-Identifier: CC0-1.0

/**
CREDITS:

Standardisation effort:

Interface proposal & example implementation by Michael Connor, EY, 2019,
including:
Functions, arrangement, logic, inheritance structure, and interactions with a proposed Verifier Registry interface.

With thanks to:
Duncan Westland
Chaitanya Konda
Harry R
*/

/**
@title Verifier_Interface
@dev Example Verifier Implementation
@notice Do not use this example in any production code!
*/

pragma solidity ^0.6.0;

interface Verifier_Interface {

  function verify(uint256[] calldata _proof, uint256 _publicInputsHash, uint256[] calldata _vk) external returns (bool result);

}
