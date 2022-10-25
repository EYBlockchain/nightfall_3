// SPDX-License-Identifier: CC0-1.0
import './Ownable.sol';

pragma solidity ^0.8.0;

contract Whitelist is Ownable {
    bool public whitelisting;
    mapping(address => uint256) public users;
    mapping(address => uint256) public managers;

    // groupIds cannot be zero, although we don't specifcally chack for this because assigning a groupId of zero has
    // no effect other than wasting gas.

    function initialize() public virtual override onlyInitializing {
        whitelisting = false;
        Ownable.initialize();
    }

    function addUserToWhitelist(address _user) external {
        // if a non-manager calls this, they will just assign someone to the zero group, which is the null value and has no effect
        users[_user] = managers[msg.sender];
    }

    function removeUserFromWhitelist(address _user) external {
        require(users[_user] != 0, 'This user is not whitelisted, so cannot be delisted');
        require(managers[msg.sender] == users[_user], 'You are not the manager of this group');
        delete users[_user];
    }

    function createWhitelistManager(uint256 _groupId, address _manager) external onlyOwner {
        managers[_manager] = _groupId;
    }

    function removeWhitelistManager(address _manager) external onlyOwner {
        delete managers[_manager];
    }

    function enableWhitelisting(bool _whitelisting) external onlyOwner {
        whitelisting = _whitelisting;
    }

    function isWhitelisted(address _user) public view returns (bool) {
        if (whitelisting == false) return true; // whitelisting is turned off
        if (users[_user] != 0) return true;
        return false;
    }

    function isWhitelistManager(address _manager) public view returns (uint256) {
        return managers[_manager];
    }
}
