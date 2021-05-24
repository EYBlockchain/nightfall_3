/**
Turns the slightly odd object/class/thing returned in a transaction-submitted event into a true transaction
*/
import Transaction from '../classes/transaction.mjs';

function mappedData(data) {
  const {
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
    historicRootBlockHash,
    proof,
  } = data.returnValues.transaction;
  const transaction = {
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
    historicRootBlockHash,
    proof,
  };
  // add in the transaction hash (we no longer sent this to the blockchain)
  transaction.transactionHash = Transaction.calcHash(transaction);
  return transaction;
}

export default mappedData;
