/**
Function to retreive calldata associated with a blockchain event.
This is used, rather than re-emmiting the calldata in the event because it's
much cheaper, although the offchain part is more complex.
*/
import config from 'config';
import Web3 from '../utils/web3.mjs';
import Transaction from '../classes/transaction.mjs';
import Block from '../classes/block.mjs';
import { decompressProof } from '../utils/curve-maths/curves.mjs';

const { PROPOSE_BLOCK_TYPES, SUBMIT_TRANSACTION_TYPES } = config;

export async function getProposeBlockCalldata(eventData) {
  const web3 = Web3.connection();
  const { transactionHash } = eventData;
  const tx = await web3.eth.getTransaction(transactionHash);
  // Remove the '0x' and function signature to recove rhte abi bytecode
  const abiBytecode = `0x${tx.input.slice(10)}`;
  const decoded = web3.eth.abi.decodeParameters(PROPOSE_BLOCK_TYPES, abiBytecode);
  const blockData = decoded['0'];
  const transactionsData = decoded['1'];
  const [proposer, root, leafCount, nCommitments, blockNumberL2] = blockData;
  const block = {
    proposer,
    root,
    leafCount: Number(leafCount),
    nCommitments: Number(nCommitments),
    blockNumberL2: Number(blockNumberL2),
  };
  const transactions = transactionsData.map(t => {
    const [
      value,
      historicRootBlockNumberL2,
      transactionType,
      publicInputHash,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      proof,
    ] = t;
    const transaction = {
      value,
      historicRootBlockNumberL2,
      transactionType,
      publicInputHash,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      proof: decompressProof(proof),
    };
    transaction.transactionHash = Transaction.calcHash(transaction);
    // note, this transaction is incomplete in that the 'fee' field is empty.
    // that shouldn't matter as it's not needed.
    return transaction;
  });
  // Let's add in data that isn't directly available from the calldata but that
  // we know how to compute. Many node functions assume these are present.
  block.blockHash = Block.calcHash(block, transactions);
  block.transactionHashes = transactions.map(t => t.transactionHash);
  // currentLeafCount holds the count of the next leaf to be added
  const currentLeafCount = Number(nCommitments) + Number(leafCount);
  return { block, transactions, currentLeafCount };
}

export async function getTransactionSubmittedCalldata(eventData) {
  const web3 = Web3.connection();
  const { transactionHash } = eventData;
  const tx = await web3.eth.getTransaction(transactionHash);
  // Remove the '0x' and function signature to recove rhte abi bytecode
  const abiBytecode = `0x${tx.input.slice(10)}`;
  const transactionData = web3.eth.abi.decodeParameter(SUBMIT_TRANSACTION_TYPES, abiBytecode);
  const [
    value,
    historicRootBlockNumberL2,
    transactionType,
    publicInputHash,
    tokenId,
    ercAddress,
    recipientAddress,
    commitments,
    nullifiers,
    proof,
  ] = transactionData;
  const transaction = {
    fee: Number(tx.value),
    value,
    historicRootBlockNumberL2,
    transactionType,
    publicInputHash,
    tokenId,
    ercAddress,
    recipientAddress,
    commitments,
    nullifiers,
    proof: decompressProof(proof),
  };
  transaction.transactionHash = Transaction.calcHash(transaction);
  return transaction;
}
