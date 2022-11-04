// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.9;

interface KYCInterface {
    function kycCheck(address user) external view returns (bool);
}
