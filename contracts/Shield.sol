// SPDX-License-Identifier: CC0-1.0

/**
Contract to enable someone to submit a ZKP transaction for processing.
It is possible we will move this off-chain in the future as blockchain
functionality is not really required - it's just a data availability aid.
@Author Westlad
*/

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import './Utils.sol';
import './ERCInterface.sol';
import './Key_Registry.sol';
import './Structures.sol';
import './Config.sol';
import './Proposers.sol';

contract Shield is Structures, Config, Key_Registry {
  /**
  We don't need to do the checks herein because the Proposer should do them.
  We don't really need this function at all because we could just send the
  transaction to a proposer.  Thus, some or all of this functionality may be
  removed in future to save Gas.
  */

  Proposers private proposers;

  constructor (address _proposersAddr) public {
    proposers = Proposers(_proposersAddr);
  }
  function submitTransaction(Transaction memory t) external payable {
    // check the transaction hash
    // require (t.transactionHash == hashTransaction(t), 'The transaction hash is not correct');
    // check they've paid correctly
    // require (t.fee == msg.value, 'The amount paid was not the same as the amount specified in the transaction');
    // TODO take payment for a Deposit - can't do it here because no guarantee
    // transaction will proceed (we could refund later if it doesn't of course).
    // if this is a deposit transaction, we should take payment now
    // let everyone know what you did
    emit TransactionSubmitted(t);
    // if this is a deposit transaction, take payment now (TODO: is there a
    // better way? This feels expensive).
    if (t.transactionType == TransactionTypes.DEPOSIT) payIn(t);
  }

  /**
  This function enables funds to be withdrawn, once a block is finalised
  @param b - the block containing the Withdraw transaction
  @param t - the actual transaction
  @param index - the index of the transaction that locates it in the array of Transactions in Block b
  */
  function finaliseWithdrawal(Block memory b, Transaction memory t, uint index) external {
    // check this block is a real one, in the queue, not something made up.
    proposers.isBlockReal(b);
    // check that the block has been finalised
    (,,,uint data) = proposers.blockHashes(b.blockHash);
    require(data + COOLING_OFF_PERIOD < block.timestamp, 'It is too soon withdraw funds from this block');
    // check the transaction is in the block
    require(b.transactionHashes[index] == Utils.hashTransaction(t), 'Transaction not found at the given index');
    if (t.transactionType == TransactionTypes.WITHDRAW) payOut(t);
  }


    function payOut(Transaction memory t) internal {
    // Now pay out the value of the commitment
      ERCInterface tokenContract = ERCInterface(
        address(uint160(uint256(t.ercAddress)))
      );
      address recipientAddress = address(uint160(uint256(t.recipientAddress)));
      if (t.tokenId == ZERO && t.value == ZERO) // disallow this corner case
        revert("Zero-value tokens are not allowed");

      if (t.tokenId == ZERO) // must be an ERC20
        tokenContract.transferFrom(
          address(this),
          recipientAddress,
          uint256(t.value)
        );
      else if (t.value == ZERO) // must be ERC721
        tokenContract.safeTransferFrom(
          address(this),
          recipientAddress,
          uint256(t.tokenId),
          ''
        );
      else // must be an ERC1155
        tokenContract.safeTransferFrom(
          address(this),
          recipientAddress,
          uint256(t.tokenId),
          uint256(t.value),
          ''
        );
    }

    function payIn(Transaction memory t) internal {
      ERCInterface tokenContract = ERCInterface(
        address(uint160(uint256(t.ercAddress)))
      );
      if (t.tokenId == ZERO && t.value == ZERO) // disallow this corner case
        revert("Depositing zero-value tokens is not allowed");
      if (t.tokenId == ZERO) // must be an ERC20
        tokenContract.transferFrom(msg.sender, address(this), uint256(t.value));
      else if (t.value == ZERO) // must be ERC721
        tokenContract.safeTransferFrom(
          msg.sender,
          address(this),
          uint256(t.tokenId),
          ''
        );
      else // must be an ERC1155
        tokenContract.safeTransferFrom(
          msg.sender,
          address(this),
          uint256(t.tokenId),
          uint256(t.value),
          ''
        );
    }
}
