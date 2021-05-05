/**
Turns the slightly odd object/class/thing returned in a transaction-submitted event into a true Block
*/
import Transaction from '../classes/transaction.mjs';

function mappedData(data) {
  const {
    block: unMappedBlock,
    transactions: unMappedTransactions,
    currentLeafCount,
  } = data.returnValues;
  const { proposer, transactionHashes, root, blockHash, leafCount } = unMappedBlock;
  const block = { proposer, transactionHashes, root, blockHash, leafCount: Number(leafCount) };
  const transactions = unMappedTransactions.map(u => {
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
      proof,
    } = u;
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
      proof,
    };
    transaction.transactionHash = Transaction.calcHash(transaction);
    return transaction;
  });
  return { block, transactions, currentLeafCount };
}

export default mappedData;
