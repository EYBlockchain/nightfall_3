// SPDX-License-Identifier: MIT
pragma solidity >=0.4.21 <0.9.0;

contract Migrations {
    address public owner;
    uint256 public last_completed_migration;

    constructor() {
        owner = msg.sender;
    }

    modifier restricted() {
        if (msg.sender == owner) _;
    }

    function setCompleted(uint256 completed) external restricted {
        last_completed_migration = completed;
    }
}
