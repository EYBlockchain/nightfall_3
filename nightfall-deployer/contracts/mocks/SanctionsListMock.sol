// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.9;

import '../SanctionsListInterface.sol';

contract SanctionsListMock is SanctionsListInterface {
    address sanctionedUser;
    constructor(address _sanctionedUser) {
        sanctionedUser = _sanctionedUser;
    }
    function isSanctioned(address user) external view returns (bool) {
        if (user == sanctionedUser) return true;
        return false;
    }
}