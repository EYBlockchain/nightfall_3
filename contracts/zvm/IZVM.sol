// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.6.10;

/**
 * @dev Interface of the ZVM contract
 */
interface IZVM {

    // event VerifierChanged(address newVerifierContract, TransactionTypes txType);
    //
    // event VKChanged(TransactionTypes txType);

    /**
    This is a convenience function, provided so that extension contracts' gateway functions may verify zApp-specific zk-SNARKs.
    */
    function verify_GM17_BLS12_377(
        uint256[] calldata _proof,
        uint256[] calldata _inputs,
        uint256 _vkID
    ) external view returns (bool);

    /**
     * @dev Register a private contract
     */
    function registerPrivateContract(
        uint256 _privateContractAddress,
        uint256[] calldata _vkIDs,
        uint256[] calldata _predators,
        uint256[] calldata _prey,
        uint256[] calldata _vkLeaves,
        uint256[] calldata _storageVariables,
        uint256 _storageRoot,
        uint256 _stateLeaf,
        address[] calldata _extensionContractAddress
    ) external;

    /**
     * @dev Verifies the execution of a function, without revealing which function has been executed.
     */
    function executePrivateFunction(
        uint256[] calldata _proof,
        uint256[] calldata _publicInputsHash, // 377-bits
        uint256[] calldata _outerNullifiers,
        uint256[] memory _newOuterCommitments,
        uint256 _commitmentRoot,
        uint256 _vkRoot,
        uint256 _publicStateRoot
    ) external;

    /**
      * @dev Updates private states via a gateway function.
      * This function MUST be called from an external ‘Extension Contract’, the address of which
      * must be pre-registered as THE ONLY contract permitted to use the given vkID.
      */
    function executeGatewayFunction(
        uint256 _vkID,
        uint256[] calldata _innerNullifiers,
        uint256[] calldata _newInnerCommitments
    ) external;

    /**
     * @dev Submit a proof of the new root after appending a valid batch of pending commitments
     */
    function updateCommitmentRoot(
        uint256[] calldata _proof,
        uint256[] calldata _inputs,
        uint256 _root,
        uint256[] calldata _commitments
    ) external;
}
