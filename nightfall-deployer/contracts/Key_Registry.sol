// SPDX-License-Identifier: CC0
// Module for registering verification keys
pragma solidity ^0.8.0;

import './Structures.sol';
import './Ownable.sol';

contract Key_Registry is Ownable, Structures {
    event VkChanged(TransactionTypes txType);

    mapping(TransactionTypes => uint256[]) public vks;

    mapping(TransactionTypes => CircuitInfo) public circuitInfo;

    function initialize() public virtual override initializer {
        Ownable.initialize();
    }

    /**
  Stores verification keys (for the 'deposit', 'transfer' and 'withdraw' computations).
  */
    function registerVerificationKey(
        uint256[] calldata _vk,
        uint16 _numberNullifiers,
        uint16 _numberCommitments,
        TransactionTypes _txType
    ) external onlyOwner {
        // CAUTION: we do not prevent overwrites of vk's. Users must listen for the emitted event to detect updates to a vk.
        vks[_txType] = _vk;
        circuitInfo[_txType] = CircuitInfo(_numberNullifiers, _numberCommitments);
        emit VkChanged(_txType);
    }

    function getVerificationKey(TransactionTypes txType) public view returns (uint256[] memory) {
        return vks[txType];
    }

    function getCircuitInfo(TransactionTypes txType) public view returns (CircuitInfo memory) {
        return circuitInfo[txType];
    }

    function getKeyRegistryAddress() public view returns (address) {
        return address(this);
    }
}
