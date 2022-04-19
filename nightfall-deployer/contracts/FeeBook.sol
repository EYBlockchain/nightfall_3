// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import './Ownable.sol';

/**
 * @dev Contract to enable user fee payments to proposers for offchain transactions
 * This is a temporary solution to go then for decentralization solution of the proposers
 */
contract FeeBook is Ownable, ReentrancyGuardUpgradeable {
    mapping(bytes32 => uint256) public feeBook;
    uint256 public fee;
    address public proposer;

    event PaymentSubmitted();

    function initialize(uint256 defaultFee, address defaultProposer) public initializer {
        Ownable.initialize();
        fee = defaultFee;
        proposer = defaultProposer;
    }

    /**
     * @dev Allows to change the proposer address
     */
    function setProposer(address newProposer) external onlyOwner {
        proposer = newProposer;
    }

    /**
     * @dev Get proposer address
     */
    function getProposer() external view returns (address) {
        return proposer;
    }

    /**
     * @dev Allows to change the fee amount to be paid for the transactions to proposer
     */
    function setFee(uint256 newFee) external onlyOwner {
        fee = newFee;
    }

    /**
     * @dev Get fee amount to be paid for the transactions to proposer
     */
    function getFee() external view returns (uint256) {
        return fee;
    }

    /**
     * @dev Check payment fee amount to be paid
     */
    function checkPayment(bytes32 transactionHashL2, uint256 transactionFee)
        external
        view
        returns (bool)
    {
        require(feeBook[transactionHashL2] > 0, 'FeeBook: payment not found');
        require(feeBook[transactionHashL2] >= transactionFee, 'FeeBook: fee lower than expected');
        return true;
    }

    /**
     * @dev Allows a user to pay the fee for the transaction transactionHashL2 to the proposer
     * with the address proposer
     */
    function pay(bytes32 transactionHashL2) external payable nonReentrant {
        require(feeBook[transactionHashL2] + msg.value >= fee, 'FeeBook: fee is too low');
        feeBook[transactionHashL2] = feeBook[transactionHashL2] + msg.value;
        (bool success, ) = payable(address(proposer)).call{value: msg.value}('');
        require(success, 'FeeBook: Transfer failed.');
        emit PaymentSubmitted();
    }
}
