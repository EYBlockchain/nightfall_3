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
    mapping(bytes32 => AdvanceWithdrawal) public advancedWithdrawals;
    mapping(bytes32 => bool) public isEscrowed; // Check if transaction commitment values has been escrowed (only for deposit)

    address public challengesAddress;

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

    function submitTransaction(Transaction calldata t) external payable nonReentrant whenNotPaused {
        // let everyone know what you did
        emit TransactionSubmitted();
        require(isWhitelisted(msg.sender), 'You are not authorised to transact using Nightfall');
        if (t.transactionType == TransactionTypes.DEPOSIT) {
            isEscrowed[Utils.hashTransaction(t)] = true;
            require(uint256(t.fee) == msg.value);
            payIn(t);
        }
    }

    // function to enable a proposer to get paid for proposing a block
    function requestBlockPayment(Block calldata b) external {
        bytes32 blockHash = Utils.hashBlock(b);

        BlockData memory blockData = state.getBlockData(b.blockNumberL2);
        require(blockData.blockHash == blockHash, 'Shield: This block does not exist');

        // check that the block has been finalised
        require(
            blockData.time + CHALLENGE_PERIOD < block.timestamp,
            'Shield: Too soon to get paid for this block'
        );
        require(b.proposer == msg.sender, 'Shield: Not the proposer of this block');
        require(
            !state.isBlockStakeWithdrawn(blockHash),
            'Shield: Block stake for this block already claimed'
        );
        state.setBlockStakeWithdrawn(blockHash);

        //Request fees
        (uint256 feePaymentsEth, uint256 feePaymentsMatic) = state.getFeeBookInfo(
            b.proposer,
            b.blockNumberL2
        );

        state.resetFeeBookInfo(b.proposer, b.blockNumberL2);

        if (feePaymentsEth > 0) {
            (bool success, ) = payable(address(state)).call{value: feePaymentsEth}('');
            require(success, 'Shield: Transfer failed.');
        }

        if (feePaymentsMatic > 0) {
            IERC20Upgradeable(super.getMaticAddress()).safeTransfer(
                address(state),
                feePaymentsMatic
            );
        }

        // recover the stake for that block
        TimeLockedStake memory stake = state.getStakeAccount(msg.sender);
        stake.amount += blockData.blockStake;
        stake.challengeLocked -= blockData.blockStake;
        state.setStakeAccount(msg.sender, stake.amount, stake.challengeLocked);

        state.addPendingWithdrawal(msg.sender, feePaymentsEth, feePaymentsMatic);
    }

    /**
     * @dev Check if a block has been paid to the proposer
     */
    function isBlockPaymentPending(uint256 blockNumberL2) external view returns (bool) {
        BlockData memory blockData = state.getBlockData(blockNumberL2);
        require(
            blockData.time + CHALLENGE_PERIOD < block.timestamp,
            'Shield: Too soon to get paid for this block'
        );
        require(
            !state.isBlockStakeWithdrawn(blockData.blockHash),
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
        return 0xf23a6e61;
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
        bytes32 transactionHash = state.areBlockAndTransactionReal(b, t, index, siblingPath);
        // check that the block has been finalised
        require(
            t.transactionType == TransactionTypes.WITHDRAW,
            'Shield: Transaction is not a valid withdraw'
        );
        require(
            state.getBlockData(b.blockNumberL2).time + CHALLENGE_PERIOD < block.timestamp,
            'Shield: Too soon to withdraw funds from this block'
        );

        require(!withdrawn[transactionHash], 'Shield: This transaction has already paid out');

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
        bytes32 transactionHash = state.areBlockAndTransactionReal(b, t, index, siblingPath);
        // check that the block has been finalised
        require(
            state.getBlockData(b.blockNumberL2).time + CHALLENGE_PERIOD < block.timestamp,
            'Shield: Too soon to withdraw funds from this block'
        );
        require(
            t.transactionType == TransactionTypes.WITHDRAW,
            'Shield: Transaction is not a valid withdraw'
        );
        require(!withdrawn[transactionHash], 'Shield: This transaction has already paid out');
        withdrawn[transactionHash] = true;

        AdvanceWithdrawal memory advancedWithdrawal = advancedWithdrawals[transactionHash];
        address originalRecipientAddress = address(uint160(uint256(t.recipientAddress)));
        // check if an advancedWithdrawal has been paid, if so payout the new owner.
        address recipientAddress = advancedWithdrawal.currentOwner == address(0)
            ? originalRecipientAddress
            : advancedWithdrawal.currentOwner;

        delete advancedWithdrawals[transactionHash];

        if (advancedWithdrawal.advanceFee > 0) {
            (bool success, ) = payable(address(state)).call{
                value: uint256(advancedWithdrawal.advanceFee)
            }('');
            require(success, 'Shield: Transfer failed.');

            state.addPendingWithdrawal(recipientAddress, uint256(advancedWithdrawal.advanceFee), 0);
        }
        require(isWhitelisted(msg.sender), 'Shield: You are not authorised to withdraw funds');
        payOut(t, recipientAddress);
    }

    // Currently this can pose as a non-interactive way for transactors to get their withdrawals
    // Instead of calling finaliseWithdrawal (a pull op), advanceWithdrawal will send them the funds (push op) for a fee.
    function advanceWithdrawal(
        Block calldata b,
        Transaction calldata t,
        uint256 index,
        bytes32[] calldata siblingPath
    ) external {
        // check this block is a real one, in the queue, not something made up.
        bytes32 transactionHash = state.areBlockAndTransactionReal(b, t, index, siblingPath);

        // if no fee is set, then the withdrawal is not tagged as advanceable - else someone could just steal withdrawals
        require(
            advancedWithdrawals[transactionHash].advanceFee > 0,
            'Shield: No advanced fee has been set for this withdrawal'
        );

        //Check that the withdrawal is still challengeable
        require(
            state.getBlockData(b.blockNumberL2).time + CHALLENGE_PERIOD >= block.timestamp,
            'Shield: The block has already been finalized'
        );

        // The withdrawal has not been withdrawn
        require(!withdrawn[transactionHash], 'Shield: This transaction has already paid out');

        // this might incentives sniping freshly finalised blocks by liquidity providers
        // this is risk-free as the block is finalised, the advancedFee should reflect a risk premium.
        address tokenAddress = address(uint160(uint256(t.ercAddress)));
        address originalRecipientAddress = address(uint160(uint256(t.recipientAddress)));
        address currentOwner = advancedWithdrawals[transactionHash].currentOwner == address(0)
            ? originalRecipientAddress
            : advancedWithdrawals[transactionHash].currentOwner;
        uint256 advanceFee = advancedWithdrawals[transactionHash].advanceFee;

        // set new owner of transaction, settign fee to zero.
        advancedWithdrawals[transactionHash].advanceFee = 0;
        advancedWithdrawals[transactionHash].currentOwner = msg.sender;
        state.addPendingWithdrawal(msg.sender, advanceFee, 0);
        (bool success, ) = payable(address(state)).call{value: uint256(advanceFee)}('');
        require(success, 'Shield: Transfer failed.');

        IERC20Upgradeable(tokenAddress).safeTransferFrom(
            address(msg.sender),
            currentOwner,
            uint256(t.value)
        );
    }

    function setAdvanceWithdrawalFee(
        Block calldata b,
        Transaction calldata t,
        uint256 index,
        bytes32[] calldata siblingPath
    ) external payable nonReentrant {
        // check this block is a real one, in the queue, not something made up.
        bytes32 transactionHash = state.areBlockAndTransactionReal(b, t, index, siblingPath);

        // The transaction is a withdrawal transaction
        require(
            t.transactionType == TransactionTypes.WITHDRAW,
            'Shield: Can only advance withdrawals'
        );

        require(msg.value > 0, 'Shield: Advance fee cannot be zero');

        //Check that the withdrawal is still challengeable
        require(
            state.getBlockData(b.blockNumberL2).time + CHALLENGE_PERIOD >= block.timestamp,
            'Shield: The block has already been finalized'
        );

        require(
            t.tokenType == TokenType.ERC20 && t.tokenId == ZERO,
            'Shield: Can only advance withdrawals for fungible tokens'
        );

        // The withdrawal has not been withdrawn
        require(!withdrawn[transactionHash], 'Shield: This transaction has already paid out');
        AdvanceWithdrawal memory advancedWithdrawal = advancedWithdrawals[transactionHash];
        address originalRecipientAddress = address(uint160(uint256(t.recipientAddress)));
        address currentOwner = advancedWithdrawal.currentOwner == address(0)
            ? originalRecipientAddress
            : advancedWithdrawal.currentOwner;

        // Only the owner of the withdraw can set the advanced withdrawal
        require(
            msg.sender == currentOwner,
            'Shield: You are not the current owner of this withdrawal'
        );

        advancedWithdrawal.advanceFee += uint96(msg.value);
        advancedWithdrawals[transactionHash] = advancedWithdrawal;
        emit InstantWithdrawalRequested(transactionHash, msg.sender, advancedWithdrawal.advanceFee);
    }

    function payOut(Transaction calldata t, address recipientAddress) internal whenNotPaused {
        // Now pay out the value of the commitment
        address addr = address(uint160(uint256(t.ercAddress)));

        if (t.tokenType == TokenType.ERC20) {
            if (t.tokenId != ZERO)
                revert('Shield: ERC20 withdrawal should have tokenId equal to ZERO');
            if (t.value > super.getRestriction(addr, 1))
                revert('Shield: Value is above current restrictions for withdrawals');
            else IERC20Upgradeable(addr).safeTransfer(recipientAddress, uint256(t.value));
        } else if (t.tokenType == TokenType.ERC721) {
            if (t.value != 0)
                // value should always be equal to 0
                revert('Shield: Invalid inputs for ERC721 withdrawal');
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
