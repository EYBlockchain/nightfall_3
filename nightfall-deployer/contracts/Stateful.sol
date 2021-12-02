// SPDX-License-Identifier: CC0-1.0

/**
Contract that should be extended by contracts that require access to global state.
@Author Westlad
*/

pragma solidity ^0.8.0;

import "./State.sol";

abstract contract Stateful {
    State public state;
    address deployer;
    bool done;

    constructor() {
        deployer = msg.sender;
        done = false;
    }

    modifier onlyOnce {
        require(msg.sender == deployer && !done, "Only the owner can call this, once.");
        done = true;
        _;
    }

    // point this contract at its global state.
    function setStateContract(address payable stateAddress) external onlyOnce {
        state = State(stateAddress);
    }
}
