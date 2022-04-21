// SPDX-License-Identifier: CC0-1.0

/**
An interface that will work with both (at least) ERC20, ERC721 contracts
It's very minimal but it's all that a Shield contract needs.  This way
we don't need separate code for FT and NFT token-types so it's more
efficient and the code is much DRYer.
*/

pragma solidity ^0.8.0;

interface ERCInterface {
  function transfer(address to, uint256 value)
    external returns (bool);

  function transferFrom(address from, address to, uint256 value)
    external returns (bool);

  function safeTransferFrom(
    address from, address to, uint256 value, bytes calldata _data
  )
    external;

  function safeTransferFrom(
    address from, address to, uint256 id, uint256 value, bytes calldata _data
  )
    external;



  event Transfer(
    address indexed from,
    address indexed to,
    uint256 value
  );
}
