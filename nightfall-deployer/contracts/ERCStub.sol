// SPDX-License-Identifier: CC0-1.0

/**
An stub implementation of the ERCInterface
It's very minimal but it's all that we need for Shield contract testing
*/

pragma solidity ^0.8.0;

contract ERCStub {
  //ERC20
  bytes private data;
  uint256 private id;

  function transfer(
    address to,
    uint256 value
  ) external returns (bool) {
    emit Transfer(msg.sender, to, value);
    return true;
  }
  function transferFrom(
    address from,
    address to,
    uint256 value
  ) external returns (bool) {
    emit Transfer(from, to, value);
    return true;
  }
  // ERC721
  function safeTransferFrom(
    address from,
    address to,
    uint256 value,
    bytes calldata _data
  ) external {
    data = _data;
    emit Transfer(from, to, value);
  }
  // ERC1155 (TODO check event)
  function safeTransferFrom(
    address from,
    address to,
    uint256 _id,
    uint256 value,
    bytes calldata _data
  ) external {
    data = _data;
    id = _id;
    emit Transfer(from, to, value);
  }

  event Transfer(
    address indexed from,
    address indexed to,
    uint256 value
  );
}
