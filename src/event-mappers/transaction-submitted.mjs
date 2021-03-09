/**
Turns the slightly odd object/class/thing returned in a transaction-submitted event into a true transaction
*/

import Transaction from '../classes/transaction.mjs';

function mappedData(data) {
  const {
    transactionHash,
    fee,
    transactionType,
    publicInputHash,
    tokenId,
    value,
    ercAddress,
    recipientAddress,
    commitments,
    nullifiers,
    historicRoot,
    proof,
  } = data.returnValues.transaction;
  const transaction = {
    transactionHash,
    fee,
    transactionType,
    publicInputHash,
    tokenId,
    value,
    ercAddress,
    recipientAddress,
    commitments,
    nullifiers,
    historicRoot,
    proof,
  };
  return transaction;
}

export default mappedData;
