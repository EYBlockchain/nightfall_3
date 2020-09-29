// SPDX-License-Identifier: CC0-1

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
@title IVerifier
@dev Example Verifier Implementation
@notice Do not use this example in any production code!
*/

pragma solidity >=0.5.0 <7.0.0;

interface IVerifier {
    function verify(
        uint256[] calldata _proof,
        uint256[] calldata _inputs,
        uint256[] calldata _vk
    ) external view returns (bool result);
}
