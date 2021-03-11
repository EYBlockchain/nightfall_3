/**
Turns the slightly odd object/class/thing returned in a transaction-submitted event into a true Block
*/

import Block from '../classes/block.mjs';
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
    } = u;
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
  });
  return { block, transactions, currentLeafCount };
}

export default mappedData;
