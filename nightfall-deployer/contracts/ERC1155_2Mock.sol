// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract ERC1155_2Mock is ERC1155 {
    uint256 public constant GOLD_2 = 0;
    uint256 public constant SILVER_2 = 1;
    uint256 public constant THORS_HAMMER_2 = 2;
    uint256 public constant SWORD_2 = 3;
    uint256 public constant SHIELD_2 = 4;

    constructor() ERC1155("https://game.example/api/item/{id}.json") {
        _mint(msg.sender, GOLD_2, 10**18, "");
        _mint(msg.sender, SILVER_2, 10**27, "");
        _mint(msg.sender, THORS_HAMMER_2, 1, "");
        _mint(msg.sender, SWORD_2, 10**9, "");
        _mint(msg.sender, SHIELD_2, 10**9, "");
    }
}