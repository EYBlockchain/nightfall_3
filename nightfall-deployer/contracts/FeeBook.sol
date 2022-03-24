// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./Ownable.sol";

/**
 * @dev Contract to enable user fee payments to proposers for offchain transactions
 * This is a temporary solution to go then for decentralization solution of the proposers
 */
contract FeeBook is Ownable, ReentrancyGuardUpgradeable {
    mapping(bytes32 => uint256) public feeBook;
    uint256 public fee;

    event PaymentSubmitted();

    function initialize(uint256 defaultFee) public initializer {
        Ownable.initialize();
        fee = defaultFee;
    }

    /**
     * @dev Allows to change the fee amount to be paid
     */
    function setFee(uint256 newFee) external onlyOwner {
        fee = newFee;
    }

    /**
     * @dev Get fee amount to be paid
     */
    function getFee() external view returns(uint256) {
        return fee;
    }

    /**
     * @dev Allows a user to pay the fee for the transaction transactionHashL2 to the proposer
     * with the address proposerAddress
     */
    function pay(address proposerAddress, bytes32 transactionHashL2) external payable nonReentrant {
        require(feeBook[transactionHashL2] + msg.value >= fee, "FeeBook: fee is too low");
        feeBook[transactionHashL2] = feeBook[transactionHashL2] + msg.value;
        (bool success, ) = payable(address(proposerAddress)).call{value: msg.value}("");
        require(success, "FeeBook: Transfer failed.");
        emit PaymentSubmitted();
    }
}
