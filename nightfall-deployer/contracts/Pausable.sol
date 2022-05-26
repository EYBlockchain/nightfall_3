// SPDX-License-Identifier: CC0-1.0

import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';

pragma solidity ^0.8.0;

abstract contract Pausable is PausableUpgradeable {

  address public pauser;

  function initialize() public virtual initializer {
    PausableUpgradeable.__Pausable_init();
    pauser = msg.sender; // pauser and deployer are the same
  }

  modifier onlyPauser {
      // Modifier
      require(
          msg.sender == pauser,
          'Only the pauser can call this.'
      );
      _;
  }

  function pause() external onlyPauser {
    _pause();
  }

  function unpause() external onlyPauser {
    _unpause();
  }
}
