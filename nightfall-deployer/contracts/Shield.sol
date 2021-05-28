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
import './Proposals.sol';

contract Shield is Structures, Config, Key_Registry {

  Proposals private proposals;

  constructor (address proposalsAddr) {
    proposals = Proposals(proposalsAddr);
  }
  function submitTransaction(Transaction memory t) external payable {
    // let everyone know what you did
    emit TransactionSubmitted();
    // if this is a deposit transaction, take payment now (TODO: is there a
    // better way? This feels expensive).
    if (t.transactionType == TransactionTypes.DEPOSIT) payIn(t);
  }

  /**
  This function enables funds to be withdrawn, once a block is finalised
  @param b - the block containing the Withdraw transaction
  @param ts - array of the transactions contained in the block
  @param index - the index of the transaction that locates it in the array of Transactions in Block b
  */
  function finaliseWithdrawal(Block memory b, Transaction[] memory ts, uint index) external {
    // check this block is a real one, in the queue, not something made up.
    proposals.isBlockReal(b, ts);
    // check that the block has been finalised
    uint time = proposals.getBlockData(b.blockNumberL2).time;
    require(time + COOLING_OFF_PERIOD < block.timestamp, 'It is too soon withdraw funds from this block');
    if (ts[index].transactionType == TransactionTypes.WITHDRAW) payOut(ts[index]);
  }

  function payOut(Transaction memory t) internal {
  // Now pay out the value of the commitment
    ERCInterface tokenContract = ERCInterface(
      address(uint160(uint256(t.ercAddress)))
    );
    address recipientAddress = address(uint160(uint256(t.recipientAddress)));
    if (t.tokenId == ZERO && t.value == 0) // disallow this corner case
      revert("Zero-value tokens are not allowed");

    if (t.tokenId == ZERO) // must be an ERC20
      tokenContract.transferFrom(
        address(this),
        recipientAddress,
        uint256(t.value)
      );
    else if (t.value == 0) // must be ERC721
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
    if (t.tokenId == ZERO && t.value == 0) // disallow this corner case
      revert("Depositing zero-value tokens is not allowed");
    if (t.tokenId == ZERO) // must be an ERC20
      tokenContract.transferFrom(msg.sender, address(this), uint256(t.value));
    else if (t.value == 0) // must be ERC721
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
