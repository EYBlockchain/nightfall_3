// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.3;

interface X509Interface {
    function x509Check(address user) external view returns (bool);
}
