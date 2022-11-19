// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.9;

interface SanctionsListInterface {
    function isSanctioned(address addr) external view returns (bool);
}