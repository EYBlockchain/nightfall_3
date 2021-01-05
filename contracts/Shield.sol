// SPDX-License-Identifier: CC0-1.0

/**
Contract to enable someone to submit a ZKP transaction for processing.
It is possible we will move this off-chain in the future as blockchain
functionality is not really required - it's just a data availability aid.
@Author Westlad
*/

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import './Structures.sol';
import './Utils.sol';

contract Shield is Structures, Utils {

  function submitTransaction(Transaction memory t) external payable {
    //check the transaction hash
    require (t.transactionHash == hashTransaction(t), 'The transaction hash is not correct');
    //check they've paid correctly
    require (t.fee == msg.value, 'The amount paid was not the same as the amount specified in the transaction');
    // TODO take payment for a Deposit - can't do it here because no guarantee
    // transaction will proceed (we could refund later if it doesn't of course).

    // let everyone know what you did
    emit TransactionSubmitted(t);
  }

  /**
  This function is called to add a block to the permanent record of state in
  the Shield contract.  Who calls it is currently a point of debate (but anyone
  _can_)
  */
  function updateShieldState() external {

  }
}
