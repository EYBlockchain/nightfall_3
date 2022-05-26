// SPDX-License-Identifier: CC0-1.0
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
/**
Contract to enable someone to submit a ZKP transaction for processing.
It is possible we will move this off-chain in the future as blockchain
functionality is not really required - it's just a data availability aid.
@Author Westlad
*/

pragma solidity ^0.8.0;

import './Utils.sol';
import './ERCInterface.sol';
import './Key_Registry.sol';
import './Structures.sol';
import './Config.sol';
import './Stateful.sol';
import './Ownable.sol';
import './Pausable.sol';

contract Shield is Stateful, Ownable, Structures, Config, Key_Registry, ReentrancyGuardUpgradeable, Pausable {
    mapping(bytes32 => bool) public withdrawn;
    mapping(bytes32 => uint256) public feeBook;
    mapping(bytes32 => address) public advancedWithdrawals;
    mapping(bytes32 => uint256) public advancedFeeWithdrawals;

    function initialize() public override(Stateful, Key_Registry, Config, Ownable, Pausable) initializer {
        Stateful.initialize();
        Key_Registry.initialize();
        Config.initialize();
        Ownable.initialize();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        Pausable.initialize();
    }git add 

    function transferShieldBalance(address ercAddress, uint256 value) public onlyOwner {
        ERCInterface tokenContract = ERCInterface(ercAddress);
        if (value == uint256(0)) {
            uint256 balance = tokenContract.balanceOf(address(this));
            tokenContract.transfer(owner(), balance);
        } else {
            tokenContract.transfer(owner(), value);
        }
    }

    function submitTransaction(Transaction memory t) external payable nonReentrant whenNotPaused {
        // let everyone know what you did
        emit TransactionSubmitted();
        // if this is a deposit transaction, take payment now (TODO: is there a
        // better way? This feels expensive).
        if (t.transactionType == TransactionTypes.DEPOSIT) payIn(t);
        // we need to remember the payment made for each transaction so we can pay
        // the proposer later. We can override the transaction with a higher fee if
        // we wish, but not lower it (because otherwise someone would be able to
        // slow down or stop our transaction)
        bytes32 transactionHash = Utils.hashTransaction(t);
        if (feeBook[transactionHash] < msg.value) feeBook[transactionHash] = msg.value;
        (bool success, ) = payable(address(state)).call{value: msg.value}('');
        require(success, 'Transfer failed.');
    }

    // function to enable a proposer to get paid for proposing a block
    function requestBlockPayment(Block memory b, Transaction[] memory ts) external {
        bytes32 blockHash = state.areBlockAndTransactionsReal(b, ts);
        // check that the block has been finalised
        uint256 time = state.getBlockData(b.blockNumberL2).time;
        require(
            time + COOLING_OFF_PERIOD < block.timestamp,
            'It is too soon to get paid for this block'
        );
        require(b.proposer == msg.sender, 'You are not the proposer of this block');
        require(
            state.isBlockStakeWithdrawn(blockHash) == false,
            'The block stake for this block is already claimed'
        );
        state.setBlockStakeWithdrawn(blockHash);
        // add up how much the proposer is owed.
        uint256 payment;
        for (uint256 i = 0; i < ts.length; i++) {
            bytes32 transactionHash = Utils.hashTransaction(ts[i]);
            payment += feeBook[transactionHash];
            feeBook[transactionHash] = 0; // clear the payment
        }
        payment += BLOCK_STAKE;
        state.addPendingWithdrawal(msg.sender, payment);
    }

    function onERC721Received(
        address,
        address _from,
        uint256 _tokenId,
        bytes calldata
    ) external returns (bytes4) {
        return 0x150b7a02;
    }

    function onERC1155Received(
        address _operator,
        address _from,
        uint256 _id,
        uint256 _value,
        bytes calldata _data
    ) external returns (bytes4) {
        return bytes4(keccak256('onERC1155Received(address,address,uint256,uint256,bytes)'));
    }

    /* *
  This function returns if you are able to withdraw the funds, once a block is finalised
  @param b - the block containing the Withdraw transaction
  @param t - array of the transactions contained in the block
  @param index - the index of the transaction that locates it in the array of Transactions in Block b
  */
    function isValidWithdrawal(
        Block memory b,
        Transaction memory t,
        uint256 index,
        bytes32[6] memory siblingPath
    ) external view returns (bool) {
        // check this block is a real one, in the queue, not something made up.
        state.areBlockAndTransactionReal(b, t, index, siblingPath);
        // check that the block has been finalised
        uint256 time = state.getBlockData(b.blockNumberL2).time;
        require(
            time + COOLING_OFF_PERIOD < block.timestamp,
            'It is too soon to withdraw funds from this block'
        );

        bytes32 transactionHash = Utils.hashTransaction(t);
        require(!withdrawn[transactionHash], 'This transaction has already paid out');
        require(
            t.transactionType == TransactionTypes.WITHDRAW,
            'This transaction is not a valid WITHDRAW'
        );

        return true;
    }

    /**
  This function enables funds to be withdrawn, once a block is finalised
  @param b - the block containing the Withdraw transaction
  @param t - array of the transactions contained in the block
  @param index - the index of the transaction that locates it in the array of Transactions in Block b
  TODO do we need to pass in  all the block data?
  */

    function finaliseWithdrawal(
        Block calldata b,
        Transaction calldata t,
        uint256 index,
        bytes32[6] memory siblingPath
    ) external {
        // check this block is a real one, in the queue, not something made up and that the transaction exists in the block
        state.areBlockAndTransactionReal(b, t, index, siblingPath);
        // check that the block has been finalised
        uint256 time = state.getBlockData(b.blockNumberL2).time;
        require(
            time + COOLING_OFF_PERIOD < block.timestamp,
            'It is too soon to withdraw funds from this block'
        );
        bytes32 transactionHash = Utils.hashTransaction(t);
        require(!withdrawn[transactionHash], 'This transaction has already paid out');
        withdrawn[transactionHash] = true;
        if (t.transactionType == TransactionTypes.WITHDRAW) {
            address originalRecipientAddress = address(uint160(uint256(t.recipientAddress)));
            // check if an advancedWithdrawal has been paid, if so payout the new owner.
            address recipientAddress =
                advancedWithdrawals[transactionHash] == address(0)
                    ? originalRecipientAddress
                    : advancedWithdrawals[transactionHash];
            payOut(t, recipientAddress);
        }
    }

    // TODO does this need to be constrained to blocks within the challenge window
    // Currently this can pose as a non-interactive way for transactors to get their withdrawals
    // Instead of calling finaliseWithdrawal (a pull op), advanceWithdrawal will send them the funds (push op) for a fee.
    function advanceWithdrawal(Transaction memory withdrawTransaction) external {
        bytes32 withdrawTransactionHash = Utils.hashTransaction(withdrawTransaction);

        // if no fee is set, then the withdrawal is not tagged as advanceable - else someone could just steal withdrawals
        require(
            advancedFeeWithdrawals[withdrawTransactionHash] > 0,
            'No advanced fee has been set for this withdrawal'
        );
        require(
            withdrawTransaction.tokenType == TokenType.ERC20,
            'Can only advance withdrawals for fungible tokens'
        );
        // The withdrawal has not been withdrawn
        require(!withdrawn[withdrawTransactionHash], 'Cannot double withdraw');

        // TODO should we check if the withdrawal is not in a finalised block
        // this might incentives sniping freshly finalised blocks by liquidity providers
        // this is risk-free as the block is finalised, the advancedFee should reflect a risk premium.

        ERCInterface tokenContract =
            ERCInterface(address(uint160(uint256(withdrawTransaction.ercAddress))));
        address originalRecipientAddress =
            address(uint160(uint256(withdrawTransaction.recipientAddress)));
        address currentOwner =
            advancedWithdrawals[withdrawTransactionHash] == address(0)
                ? originalRecipientAddress
                : advancedWithdrawals[withdrawTransactionHash];
        uint256 advancedFee = advancedFeeWithdrawals[withdrawTransactionHash];

        // Send the token from the msg.sender to the receipient
        if (withdrawTransaction.tokenId != ZERO)
            revert('ERC20 deposit should have tokenId equal to ZERO');
        else {
            // set new owner of transaction, settign fee to zero.
            advancedFeeWithdrawals[withdrawTransactionHash] = 0;
            advancedWithdrawals[withdrawTransactionHash] = msg.sender;
            state.addPendingWithdrawal(msg.sender, advancedFee);
            tokenContract.transferFrom(
                address(msg.sender),
                currentOwner,
                uint256(withdrawTransaction.value)
            );
        }
    }

    // TODO Is there a better way to set this fee, e.g. at the point of making a transaction.
    function setAdvanceWithdrawalFee(
        Block memory b,
        Transaction memory t,
        uint256 index,
        bytes32[6] memory siblingPath
    ) external payable nonReentrant {
        // The transaction is a withdrawal transaction
        require(t.transactionType == TransactionTypes.WITHDRAW, 'Can only advance withdrawals');

        // check this block is a real one, in the queue, not something made up.
        state.areBlockAndTransactionReal(b, t, index, siblingPath);

        bytes32 withdrawTransactionHash = Utils.hashTransaction(t);
        // The withdrawal has not been withdrawn
        require(!withdrawn[withdrawTransactionHash], 'Cannot double withdraw');
        address originalRecipientAddress = address(uint160(uint256(t.recipientAddress)));
        address currentOwner =
            advancedWithdrawals[withdrawTransactionHash] == address(0)
                ? originalRecipientAddress
                : advancedWithdrawals[withdrawTransactionHash];

        // Only the owner of the withdraw can set the advanced withdrawal
        require(msg.sender == currentOwner, 'You are not the current owner of this withdrawal');
        advancedFeeWithdrawals[withdrawTransactionHash] = msg.value;
        (bool success, ) = payable(address(state)).call{value: msg.value}('');
        require(success, 'Transfer failed.');
        emit InstantWithdrawalRequested(withdrawTransactionHash, msg.sender, msg.value);
    }

    function payOut(Transaction memory t, address recipientAddress) internal whenNotPaused {
        // Now pay out the value of the commitment
        address addr = address(uint160(uint256(t.ercAddress)));
        ERCInterface tokenContract = ERCInterface(addr);
        // address recipientAddress = address(uint160(uint256(t.recipientAddress)));

        if (t.tokenType == TokenType.ERC20) {
            if (t.tokenId != ZERO) revert('ERC20 deposit should have tokenId equal to ZERO');
            if (t.value > super.getRestriction(addr, 1))
                revert('Value is above current restrictions for withdrawals');
            else tokenContract.transfer(recipientAddress, uint256(t.value));
        } else if (t.tokenType == TokenType.ERC721) {
            if (t.value != 0)
                // value should always be equal to 0
                revert('Invalid inputs for ERC721 deposit');
            else
                tokenContract.safeTransferFrom(
                    address(this),
                    recipientAddress,
                    uint256(t.tokenId),
                    ''
                );
        } else if (t.tokenType == TokenType.ERC1155) {
            tokenContract.safeTransferFrom(
                address(this),
                recipientAddress,
                uint256(t.tokenId),
                uint256(t.value),
                ''
            );
        } else {
            revert('Invalid Token Type');
        }
    }

    function payIn(Transaction memory t) internal {
        address addr = address(uint160(uint256(t.ercAddress)));
        ERCInterface tokenContract = ERCInterface(addr);

        if (t.tokenType == TokenType.ERC20) {
            if (t.tokenId != ZERO) revert('ERC20 deposit should have tokenId equal to ZERO');
            uint256 check = super.getRestriction(addr, 0);
            require(check > 0, 'Cannot have restrictions of zero value');
            if (t.value > check)
                revert('Value is above current restrictions for deposits');
            else require(tokenContract.transferFrom(msg.sender, address(this), uint256(t.value)), 'transferFrom returned false');
        } else if (t.tokenType == TokenType.ERC721) {
            if (t.value != 0)
                // value should always be equal to 0
                revert('Invalid inputs for ERC721 deposit');
            else tokenContract.safeTransferFrom(msg.sender, address(this), uint256(t.tokenId), '');
        } else if (t.tokenType == TokenType.ERC1155) {
            tokenContract.safeTransferFrom(
                msg.sender,
                address(this),
                uint256(t.tokenId),
                uint256(t.value),
                ''
            );
        } else {
            revert('Invalid Token Type');
        }
    }
}
