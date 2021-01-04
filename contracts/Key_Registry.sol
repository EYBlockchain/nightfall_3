// SPDX-License-Identifier: CC0
// Module for registering verification keys
pragma solidity ^0.6.0;

import './Structures.sol';
import './Ownable.sol';

contract Key_Registry is Structures, Ownable {

  event VkChanged(TransactionTypes txType);

  mapping(TransactionTypes => uint256[]) public vks;

  /**
  Stores verification keys (for the 'deposit', 'transfer' and 'withdraw' computations).
  */
  function registerVerificationKey(uint256[] calldata _vk, TransactionTypes _txType) external onlyOwner {
      // CAUTION: we do not prevent overwrites of vk's. Users must listen for the emitted event to detect updates to a vk.
      vks[_txType] = _vk;
      emit VkChanged(_txType);
  }
}
