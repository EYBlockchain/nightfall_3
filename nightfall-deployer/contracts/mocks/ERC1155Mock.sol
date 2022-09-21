// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract ERC1155Mock is ERC1155 {
    uint256 public constant GOLD = 0;
    uint256 public constant SILVER = 1;
    uint256 public constant THORS_HAMMER = 2;
    uint256 public constant SWORD = 3;
    uint256 public constant SHIELD = 4;

    constructor() ERC1155("https://game.example/api/item/{id}.json") {
        _mint(msg.sender, GOLD, 1100000, "");
        _mint(msg.sender, SILVER, 1200000, "");
        _mint(msg.sender, THORS_HAMMER, 10, "");
        _mint(msg.sender, SWORD, 100, "");
        _mint(msg.sender, SHIELD, 1100000, "");
    }
}