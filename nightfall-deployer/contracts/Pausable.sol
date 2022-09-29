// SPDX-License-Identifier: CC0-1.0

import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import './Ownable.sol';

pragma solidity ^0.8.0;

abstract contract Pausable is PausableUpgradeable, Ownable {

  function initialize() public override(Ownable) virtual onlyInitializing {
    Ownable.initialize();
    PausableUpgradeable.__Pausable_init();
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }
}
