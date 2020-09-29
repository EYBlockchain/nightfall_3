// SPDX-License-Identifier: CC0-1.0

/**
Example extension contract.
@Author iAmMichaelConnor
*/

pragma solidity ^0.6.10;

import "./IZVM.sol";


contract ExtensionContract {

  IZVM public zvm; // the zvm smart contract

  constructor (address _zvm) public {
      zvm = IZVM(_zvm);
  }

  function verifyWrapper(
      uint256[] calldata _proof,
      uint256[] calldata _publicInputsHash,
      uint256 _vkID
  ) external view returns (bool success) {

      success = zvm.verify_GM17_BLS12_377(
          _proof,
          _publicInputsHash,
          _vkID
      );
  }
}
