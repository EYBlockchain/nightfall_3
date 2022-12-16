// SPDX-License-Identifier: CC0
// Module for registering verification keys
pragma solidity ^0.8.0;

import './Structures.sol';
import './Ownable.sol';

contract Key_Registry is Ownable, Structures {
    event VkChanged(uint40 circuitHash);

    mapping(uint40 => uint256[]) public verificationKey;
    mapping(uint40 => CircuitInfo) public circuitInfo;

    function initialize() public virtual override onlyInitializing {
        Ownable.initialize();
    }

    /**
  Stores verification keys (for the 'deposit', 'depositFee', 'transfer', 'withdraw', 'tokenise' and 'burn' computations).
  */
    function registerVerificationKey(
        uint40 _circuitHash,
        uint256[] calldata _vk,
        bool isEscrowRequired,
        bool isWithdrawing
    ) external onlyOwner {
        // CAUTION: we do not prevent overwrites of vk's. Users must listen for the emitted event to detect updates to a vk.
        verificationKey[_circuitHash] = _vk;
        circuitInfo[_circuitHash].isEscrowRequired = isEscrowRequired;
        circuitInfo[_circuitHash].isWithdrawing = isWithdrawing;
        emit VkChanged(_circuitHash);
    }

    function getVerificationKey(uint40 circuitHash) public view returns (uint256[] memory) {
        return verificationKey[circuitHash];
    }

    function getCircuitInfo(uint40 circuitHash) public view returns (CircuitInfo memory) {
        return circuitInfo[circuitHash];
    }

    function deleteVerificationKey(uint40 circuitHash) external onlyOwner {
        delete verificationKey[circuitHash];
        delete circuitInfo[circuitHash];
    }
}
