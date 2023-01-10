// SPDX-License-Identifier: CC0-1.0
import './Ownable.sol';

pragma solidity ^0.8.0;

abstract contract Whitelist is Ownable {
    bool public whitelisting;
    mapping(address => bool) public users;

    function initialize() public virtual override onlyInitializing {
        whitelisting = true;
        Ownable.initialize();
    }

    function addUserToWhitelist(address _user) internal {
        users[_user] = true;
    }

    function enableWhitelisting(bool _whitelisting) external onlyOwner {
        whitelisting = _whitelisting;
    }

    function isWhitelisted(address _user) public view returns (bool) {
        if (whitelisting == false) return true; // whitelisting is turned off
        return users[_user];
    }
}
