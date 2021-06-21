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
  TODO do we need to pass in  all the block data?
  */
  function finaliseWithdrawal(Block memory b, uint blockNumberL2, Transaction[] memory ts, uint index) external {
    // check this block is a real one, in the queue, not something made up.
    state.isBlockReal(b, ts, blockNumberL2);
    // check that the block has been finalised
    uint time = state.getBlockData(blockNumberL2).time;
    require(time + COOLING_OFF_PERIOD < block.timestamp, 'It is too soon withdraw funds from this block');
    bytes32 transactionHash = Utils.hashTransaction(ts[index]);
    require(!withdrawn[transactionHash], 'This transaction has already paid out');
    if (ts[index].transactionType == TransactionTypes.WITHDRAW) payOut(ts[index]);
    withdrawn[transactionHash] = true;
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
