// SPDX-License-Identifier: CC0-1.0

/**
Contract to enable someone to submit a ZKP transaction for processing.
It is possible we will move this off-chain in the future as blockchain
functionality is not really required - it's just a data availability aid.
@Author Westlad
*/

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import './Utils.sol';
import './ERCInterface.sol';
import './Key_Registry.sol';
import './Structures.sol';
import './Config.sol';
import './Stateful.sol';

contract Shield is Stateful, Structures, Config, Key_Registry {

  mapping(bytes32 => bool) public withdrawn;
  mapping(bytes32 => uint) public feeBook;
  mapping(bytes32 => address) public advancedWithdrawals;
  mapping(bytes32 => uint) public advancedFeeWithdrawals;

  function submitTransaction(Transaction memory t) external payable {
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
    payable(address(state)).transfer(msg.value);
  }

  // function to enable a proposer to get paid for proposing a block
  function requestBlockPayment(Block memory b, uint blockNumberL2, Transaction[] memory ts) external {
    bytes32 blockHash = Utils.hashBlock(b, ts);
    state.isBlockReal(b, ts, blockNumberL2);
    // check that the block has been finalised
    uint time = state.getBlockData(blockNumberL2).time;
    require(time + COOLING_OFF_PERIOD < block.timestamp, 'It is too soon to get paid for this block');
    require(b.proposer == msg.sender, 'You are not the proposer of this block');
    require(state.isBlockStakeWithdrawn(blockHash) == false, 'The block stake for this block is already claimed');
    // add up how much the proposer is owed.
    uint payment;
    for (uint i = 0; i < ts.length; i++) {
      bytes32 transactionHash = Utils.hashTransaction(ts[i]);
      payment += feeBook[transactionHash];
      feeBook[transactionHash] = 0; // clear the payment
    }
    payment += BLOCK_STAKE;
    state.addPendingWithdrawal(msg.sender, payment);
  }

  function onERC721Received(address, address _from, uint256 _tokenId, bytes calldata) external returns(bytes4) {

    return 0x150b7a02;
  }

  function onERC1155Received(address _operator, address _from, uint256 _id, uint256 _value, bytes calldata _data) external returns(bytes4){
    return bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"));
  }

  /**
  This function returns if you are able to withdraw the funds, once a block is finalised and the timestamp at
  which the withdraw can be claimed
  @param b - the block containing the Withdraw transaction
  @param ts - array of the transactions contained in the block
  @param index - the index of the transaction that locates it in the array of Transactions in Block b
  */
  function isValidWithdrawal(Block memory b, uint blockNumberL2, Transaction[] memory ts, uint index) view external returns(bool, uint) {    
    // check this block is a real one, in the queue, not something made up.
    state.isBlockReal(b, ts, blockNumberL2);
    // check that the block has been finalised
    uint time = state.getBlockData(blockNumberL2).time + COOLING_OFF_PERIOD;
    
    bytes32 transactionHash = Utils.hashTransaction(ts[index]);
    // Transaction already paid
    bool valid = !withdrawn[transactionHash];
    // Withdraw transaction
    valid = ts[index].transactionType == TransactionTypes.WITHDRAW && valid;
    // Withdraw requested as instant withdraw
    valid = advancedWithdrawals[transactionHash] == address(0) && valid;
   
    return (valid, time);
  }

  /**
  This function enables funds to be withdrawn, once a block is finalised
  @param b - the block containing the Withdraw transaction
  @param ts - array of the transactions contained in the block
  @param index - the index of the transaction that locates it in the array of Transactions in Block b
  TODO do we need to pass in  all the block data?
  */
  function finaliseWithdrawal(Block memory b, uint blockNumberL2, Transaction[] memory ts, uint index) external {
    // check this block is a real one, in the queue, not something made up.
    state.isBlockReal(b, ts, blockNumberL2);
    // check that the block has been finalised
    uint time = state.getBlockData(blockNumberL2).time;
    require(time + COOLING_OFF_PERIOD < block.timestamp, 'It is too soon to withdraw funds from this block');
    bytes32 transactionHash = Utils.hashTransaction(ts[index]);
    require(!withdrawn[transactionHash], 'This transaction has already paid out');
    withdrawn[transactionHash] = true;
    if (ts[index].transactionType == TransactionTypes.WITHDRAW) {
      address originalRecipientAddress = address(uint160(uint256(ts[index].recipientAddress)));
      // check if an advancedWithdrawal has been paid, if so payout the new owner.
      address recipientAddress = advancedWithdrawals[transactionHash] == address(0) ? originalRecipientAddress : advancedWithdrawals[transactionHash];
      payOut(ts[index],recipientAddress);
    }
  }

  // TODO does this need to be constrained to blocks within the challenge window
  // Currently this can pose as a non-interactive way for transactors to get their withdrawals
  // Instead of calling finaliseWithdrawal (a pull op), advanceWithdrawal will send them the funds (push op) for a fee.
  function advanceWithdrawal(Transaction memory withdrawTransaction) external {
    bytes32 withdrawTransactionHash = Utils.hashTransaction(withdrawTransaction);

    // if no fee is set, then the withdrawal is not tagged as advanceable - else someone could just steal withdrawals
    require(advancedFeeWithdrawals[withdrawTransactionHash] > 0, 'No advanced fee has been set for this withdrawal');
    require(withdrawTransaction.tokenType == TokenType.ERC20, 'Can only advance withdrawals for fungible tokens');
    // The withdrawal has not been withdrawn
    require(!withdrawn[withdrawTransactionHash], 'Cannot double withdraw');

    // TODO should we check if the withdrawal is not in a finalised block
    // this might incentives sniping freshly finalised blocks by liquidity providers
    // this is risk-free as the block is finalised, the advancedFee should reflect a risk premium.

    ERCInterface tokenContract = ERCInterface(address(uint160(uint256(withdrawTransaction.ercAddress))));
    address originalRecipientAddress =  address(uint160(uint256(withdrawTransaction.recipientAddress)));
    address currentOwner = advancedWithdrawals[withdrawTransactionHash] == address(0) ? originalRecipientAddress : advancedWithdrawals[withdrawTransactionHash];
    uint256 advancedFee = advancedFeeWithdrawals[withdrawTransactionHash];

    // Send the token from the msg.sender to the receipient
    if (withdrawTransaction.tokenId != ZERO)
      revert("ERC20 deposit should have tokenId equal to ZERO");
    else {
      tokenContract.transferFrom(
        address(msg.sender),
        currentOwner,
        uint256(withdrawTransaction.value)
      );
    }
    // set new owner of transaction, settign fee to zero.
    advancedFeeWithdrawals[withdrawTransactionHash] = 0;
    advancedWithdrawals[withdrawTransactionHash] = msg.sender;
    state.addPendingWithdrawal(msg.sender, advancedFee);
  }

  // TODO Is there a better way to set this fee, e.g. at the point of making a transaction.
  function setAdvanceWithdrawalFee(Block memory b, uint256 blockNumberL2, Transaction[] memory ts, uint index) external payable {
    // The transaction is a withdrawal transaction
    require(ts[index].transactionType == TransactionTypes.WITHDRAW, 'Can only advance withdrawals');
    // The block and transactions are real
    state.isBlockReal(b,ts,blockNumberL2);

    bytes32 withdrawTransactionHash = Utils.hashTransaction(ts[index]);
    // The withdrawal has not been withdrawn
    require(!withdrawn[withdrawTransactionHash], 'Cannot double withdraw');
    address originalRecipientAddress =  address(uint160(uint256(ts[index].recipientAddress)));
    address currentOwner = advancedWithdrawals[withdrawTransactionHash] == address(0) ? originalRecipientAddress : advancedWithdrawals[withdrawTransactionHash];

    // Only the owner of the withdraw can set the advanced withdrawal
    require(msg.sender == currentOwner, 'You are not the current owner of this withdrawal');
    advancedFeeWithdrawals[withdrawTransactionHash] = msg.value;
    payable(address(state)).transfer(msg.value);
    emit InstantWithdrawalRequested(withdrawTransactionHash, msg.sender, msg.value);
  }

  function payOut(Transaction memory t, address recipientAddress) internal {
  // Now pay out the value of the commitment
    ERCInterface tokenContract = ERCInterface(
      address(uint160(uint256(t.ercAddress)))
    );
    // address recipientAddress = address(uint160(uint256(t.recipientAddress)));

    if(t.tokenType == TokenType.ERC20) {
      if (t.tokenId != ZERO)
        revert("ERC20 deposit should have tokenId equal to ZERO");
      else
        tokenContract.transfer(
          recipientAddress,
          uint256(t.value)
        );
    } else if(t.tokenType == TokenType.ERC721) {
      if (t.value != 0) // value should always be equal to 0
        revert("Invalid inputs for ERC721 deposit");
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
      revert("Invalid Token Type");
    }
  }

  function payIn(Transaction memory t) internal {
    ERCInterface tokenContract = ERCInterface(
      address(uint160(uint256(t.ercAddress)))
    );

    if(t.tokenType == TokenType.ERC20) {
      if (t.tokenId != ZERO)
        revert("ERC20 deposit should have tokenId equal to ZERO");
      else
        tokenContract.transferFrom(msg.sender, address(this), uint256(t.value));
    } else if(t.tokenType == TokenType.ERC721) {
      if (t.value != 0) // value should always be equal to 0
        revert("Invalid inputs for ERC721 deposit");
      else
        tokenContract.safeTransferFrom(
          msg.sender,
          address(this),
          uint256(t.tokenId),
          ''
        );
    } else if (t.tokenType == TokenType.ERC1155) {
        tokenContract.safeTransferFrom(
          msg.sender,
          address(this),
          uint256(t.tokenId),
          uint256(t.value),
          ''
        );
    } else {
      revert("Invalid Token Type");
    }
  }
}
