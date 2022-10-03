// SPDX-License-Identifier: CC0
// Module for registering verification keys
pragma solidity ^0.8.0;

import './Structures.sol';
import './Ownable.sol';

contract Key_Registry is Ownable, Structures {

  event VkChanged(TransactionTypes txType);

  mapping(TransactionTypes => uint256[]) public vks;

  function initialize() override virtual public onlyInitializing {
    Ownable.initialize();
  }
  /**
  Stores verification keys (for the 'deposit', 'transfer' and 'withdraw' computations).
  */
  function registerVerificationKey(
    uint256[] calldata _vk,
    TransactionTypes _txType)
    external onlyOwner {
      // CAUTION: we do not prevent overwrites of vk's. Users must listen for the emitted event to detect updates to a vk.
      vks[_txType] = _vk;
      emit VkChanged(_txType);
  }

  function getVerificationKey(TransactionTypes txType) public view returns(uint[] memory) {
    return vks[txType];
  }
}
