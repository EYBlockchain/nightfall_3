// SPDX-License-Identifier: CC0-1.0
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
/**
Contract to enable someone to submit a ZKP transaction for processing.
It is possible we will move this off-chain in the future as blockchain
functionality is not really required - it's just a data availability aid.
@Author Westlad
*/

pragma solidity ^0.8.0;

import './Utils.sol';
import './Config.sol';
import './Stateful.sol';
import './Pausable.sol';
import './KYC.sol';

contract Shield is Stateful, Config, ReentrancyGuardUpgradeable, Pausable, KYC {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    mapping(bytes32 => bool) public withdrawn;
    mapping(bytes32 => address) public advancedWithdrawals;
    mapping(bytes32 => uint256) public advancedFeeWithdrawals;
    mapping(bytes32 => uint256) public transactionEthFees;
    mapping(bytes32 => bool) public isEscrowed; // Check if transaction commitment values has been escrowed (only for deposit)

    function initialize() public override(Stateful, Config, Pausable, KYC) initializer {
        Stateful.initialize();
        Config.initialize();
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        Pausable.initialize();
        KYC.initialize();
    }

    function getTransactionEscrowed(bytes32 transactionHash) public view returns (bool) {
        return isEscrowed[transactionHash];
    }

    function getTransactionEthFee(bytes32 transactionHash) public view returns (uint256) {
        return transactionEthFees[transactionHash];
    }

    function submitTransaction(Transaction calldata t) external payable nonReentrant whenNotPaused {
        // let everyone know what you did
        emit TransactionSubmitted();
        require(isWhitelisted(msg.sender), 'You are not authorised to transact using Nightfall');
        if (t.transactionType == TransactionTypes.DEPOSIT) {
            bytes32 transactionHash = Utils.hashTransaction(t);
            isEscrowed[transactionHash] = true;
            transactionEthFees[transactionHash] = msg.value;
            payIn(t);
        }
    }

    // function to enable a proposer to get paid for proposing a block
    function requestBlockPayment(Block calldata b) external {
        bytes32 blockHash = Utils.hashBlock(b);

        BlockData memory blockData = state.getBlockData(b.blockNumberL2);
        require(blockData.blockHash == blockHash, 'This block does not exist');

        // check that the block has been finalised
        uint256 time = state.getBlockData(b.blockNumberL2).time;
        require(
            time + CHALLENGE_PERIOD < block.timestamp,
            'Shield: Too soon to get paid for this block'
        );
        require(b.proposer == msg.sender, 'Shield: Not the proposer of this block');
        require(
            state.isBlockStakeWithdrawn(blockHash) == false,
            'Shield: Block stake for this block already claimed'
        );
        state.setBlockStakeWithdrawn(blockHash);
        // add up how much the proposer is owed.

        //Request fees
        FeeTokens memory feePayments = state.getFeeBookBlocksInfo(b.proposer, b.blockNumberL2);
        feePayments.feesEth += blockStake;

        state.resetFeeBookBlocksInfo(b.proposer, b.blockNumberL2);

        if (feePayments.feesEth > 0) {
            (bool success, ) = payable(address(state)).call{value: feePayments.feesEth}('');
            require(success, 'Shield: Transfer failed.');
        }

        if (feePayments.feesMatic > 0) {
            IERC20Upgradeable(super.getMaticAddress()).safeTransferFrom(
                address(this),
                address(state),
                feePayments.feesMatic
            );
        }

        // recover the stake for that block
        TimeLockedStake memory stake = state.getStakeAccount(msg.sender);
        stake.amount += blockStake;
        stake.challengeLocked -= blockStake;
        state.setStakeAccount(msg.sender, stake.amount, stake.challengeLocked);

        state.addPendingWithdrawal(msg.sender, feePayments.feesEth, feePayments.feesMatic);
    }

    /**
     * @dev Check if a block has been paid to the proposer
     */
    function isBlockPaymentPending(bytes32 blockHash, uint256 blockNumberL2)
        external
        view
        returns (bool)
    {
        uint256 time = state.getBlockData(blockNumberL2).time;
        require(
            time + CHALLENGE_PERIOD < block.timestamp,
            'Shield: Too soon to get paid for this block'
        );
        require(
            state.isBlockStakeWithdrawn(blockHash) == false,
            'Shield: Block stake for this block already claimed'
        );

        return true;
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
        Block calldata b,
        Transaction calldata t,
        uint256 index,
        bytes32[] calldata siblingPath
    ) external view returns (bool) {
        // check this block is a real one, in the queue, not something made up.
        state.areBlockAndTransactionReal(b, t, index, siblingPath);
        // check that the block has been finalised
        uint256 time = state.getBlockData(b.blockNumberL2).time;
        require(
            time + CHALLENGE_PERIOD < block.timestamp,
            'Shield: Too soon to withdraw funds from this block'
        );

        bytes32 transactionHash = Utils.hashTransaction(t);
        require(!withdrawn[transactionHash], 'Shield: Transaction already paid out');
        require(
            t.transactionType == TransactionTypes.WITHDRAW,
            'Shield: Transaction is not a valid WITHDRAW'
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
        bytes32[] calldata siblingPath
    ) external {
        // check this block is a real one, in the queue, not something made up and that the transaction exists in the block
        state.areBlockAndTransactionReal(b, t, index, siblingPath);
        // check that the block has been finalised
        uint256 time = state.getBlockData(b.blockNumberL2).time;
        require(
            time + CHALLENGE_PERIOD < block.timestamp,
            'Shield: Too soon to withdraw funds from this block'
        );
        bytes32 transactionHash = Utils.hashTransaction(t);
        require(!withdrawn[transactionHash], 'Shield: This transaction has already paid out');
        withdrawn[transactionHash] = true;
        if (t.transactionType == TransactionTypes.WITHDRAW) {
            address originalRecipientAddress = address(uint160(uint256(t.recipientAddress)));
            // check if an advancedWithdrawal has been paid, if so payout the new owner.
            address recipientAddress = advancedWithdrawals[transactionHash] == address(0)
                ? originalRecipientAddress
                : advancedWithdrawals[transactionHash];
            require(isWhitelisted(msg.sender), 'You are not authorised to withdraw funds');
            payOut(t, recipientAddress);
        }
    }

    // TODO does this need to be constrained to blocks within the challenge window
    // Currently this can pose as a non-interactive way for transactors to get their withdrawals
    // Instead of calling finaliseWithdrawal (a pull op), advanceWithdrawal will send them the funds (push op) for a fee.
    function advanceWithdrawal(Transaction calldata withdrawTransaction) external {
        bytes32 withdrawTransactionHash = Utils.hashTransaction(withdrawTransaction);

        // if no fee is set, then the withdrawal is not tagged as advanceable - else someone could just steal withdrawals
        require(
            advancedFeeWithdrawals[withdrawTransactionHash] > 0,
            'Shield: No advanced fee has been set for this withdrawal'
        );
        require(
            withdrawTransaction.tokenType == TokenType.ERC20,
            'Shield: Can only advance withdrawals for fungible tokens'
        );
        // The withdrawal has not been withdrawn
        require(!withdrawn[withdrawTransactionHash], 'Shield: Cannot double withdraw');

        // TODO should we check if the withdrawal is not in a finalised block
        // this might incentives sniping freshly finalised blocks by liquidity providers
        // this is risk-free as the block is finalised, the advancedFee should reflect a risk premium.
        address tokenAddress = address(uint160(uint256(withdrawTransaction.ercAddress)));
        address originalRecipientAddress = address(
            uint160(uint256(withdrawTransaction.recipientAddress))
        );
        address currentOwner = advancedWithdrawals[withdrawTransactionHash] == address(0)
            ? originalRecipientAddress
            : advancedWithdrawals[withdrawTransactionHash];
        uint256 advancedFee = advancedFeeWithdrawals[withdrawTransactionHash];

        // Send the token from the msg.sender to the receipient
        if (withdrawTransaction.tokenId != ZERO)
            revert('Shield: ERC20 deposit should have tokenId equal to ZERO');
        else {
            // set new owner of transaction, settign fee to zero.
            advancedFeeWithdrawals[withdrawTransactionHash] = 0;
            advancedWithdrawals[withdrawTransactionHash] = msg.sender;
            state.addPendingWithdrawal(msg.sender, advancedFee, 0);
            IERC20Upgradeable(tokenAddress).safeTransferFrom(
                address(msg.sender),
                currentOwner,
                uint256(withdrawTransaction.value)
            );
        }
    }

    // TODO Is there a better way to set this fee, e.g. at the point of making a transaction.
    function setAdvanceWithdrawalFee(
        Block calldata b,
        Transaction calldata t,
        uint256 index,
        bytes32[] calldata siblingPath
    ) external payable nonReentrant {
        // The transaction is a withdrawal transaction
        require(
            t.transactionType == TransactionTypes.WITHDRAW,
            'Shield: Can only advance withdrawals'
        );

        // check this block is a real one, in the queue, not something made up.
        state.areBlockAndTransactionReal(b, t, index, siblingPath);

        bytes32 withdrawTransactionHash = Utils.hashTransaction(t);
        // The withdrawal has not been withdrawn
        require(!withdrawn[withdrawTransactionHash], 'Shield: Cannot double withdraw');
        address originalRecipientAddress = address(uint160(uint256(t.recipientAddress)));
        address currentOwner = advancedWithdrawals[withdrawTransactionHash] == address(0)
            ? originalRecipientAddress
            : advancedWithdrawals[withdrawTransactionHash];

        // Only the owner of the withdraw can set the advanced withdrawal
        require(
            msg.sender == currentOwner,
            'Shield: You are not the current owner of this withdrawal'
        );
        advancedFeeWithdrawals[withdrawTransactionHash] = msg.value;
        (bool success, ) = payable(address(state)).call{value: msg.value}('');
        require(success, 'Shield: Transfer failed.');
        emit InstantWithdrawalRequested(withdrawTransactionHash, msg.sender, msg.value);
    }

    function payOut(Transaction calldata t, address recipientAddress) internal whenNotPaused {
        // Now pay out the value of the commitment
        address addr = address(uint160(uint256(t.ercAddress)));

        if (t.tokenType == TokenType.ERC20) {
            if (t.tokenId != ZERO)
                revert('Shield: ERC20 deposit should have tokenId equal to ZERO');
            if (t.value > super.getRestriction(addr, 1))
                revert('Shield: Value is above current restrictions for withdrawals');
            else IERC20Upgradeable(addr).safeTransfer(recipientAddress, uint256(t.value));
        } else if (t.tokenType == TokenType.ERC721) {
            if (t.value != 0)
                // value should always be equal to 0
                revert('Shield: Invalid inputs for ERC721 deposit');
            else
                IERC721(addr).safeTransferFrom(
                    address(this),
                    recipientAddress,
                    uint256(t.tokenId),
                    ''
                );
        } else if (t.tokenType == TokenType.ERC1155) {
            IERC1155(addr).safeTransferFrom(
                address(this),
                recipientAddress,
                uint256(t.tokenId),
                uint256(t.value),
                ''
            );
        } else {
            revert('Shield: Invalid Token Type');
        }
    }

    function payIn(Transaction calldata t) internal {
        // check the address fits in 160 bits. This is so we can't overflow the circuit
        uint256 addrNum = uint256(t.ercAddress);
        require(
            addrNum < 0x010000000000000000000000000000000000000000,
            'Shield: The given address is more than 160 bits'
        );
        address addr = address(uint160(addrNum));

        if (t.tokenType == TokenType.ERC20) {
            if (t.tokenId != ZERO)
                revert('Shield: ERC20 deposit should have tokenId equal to ZERO');
            uint256 check = super.getRestriction(addr, 0);
            require(check > 0, 'Shield: Cannot have restrictions of zero value');
            if (t.value > check) revert('Shield: Value is above current restrictions for deposits');
            else
                IERC20Upgradeable(addr).safeTransferFrom(
                    msg.sender,
                    address(this),
                    uint256(t.value)
                );
        } else if (t.tokenType == TokenType.ERC721) {
            if (t.value != 0)
                // value should always be equal to 0
                revert('Shield: Invalid inputs for ERC721 deposit');
            else IERC721(addr).safeTransferFrom(msg.sender, address(this), uint256(t.tokenId), '');
        } else if (t.tokenType == TokenType.ERC1155) {
            IERC1155(addr).safeTransferFrom(
                msg.sender,
                address(this),
                uint256(t.tokenId),
                uint256(t.value),
                ''
            );
        } else {
            revert('Shield: Invalid Token Type');
        }
    }
}
