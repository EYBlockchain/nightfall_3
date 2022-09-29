/**
Function to retreive calldata associated with a blockchain event.
This is used, rather than re-emmiting the calldata in the event because it's
much cheaper, although the offchain part is more complex.
*/
import config from 'config';
import Web3 from 'common-files/utils/web3.mjs';
import { decompressProof } from 'common-files/utils/curve-maths/curves.mjs';
import constants from 'common-files/constants/index.mjs';
import Block from '../classes/block.mjs';
import { Transaction } from '../classes/index.mjs';

const { SIGNATURES } = config;
const { ZERO } = constants;

export async function getProposeBlockCalldata(eventData) {
  const web3 = Web3.connection();
  const { transactionHash } = eventData;
  const tx = await web3.eth.getTransaction(transactionHash);
  // Remove the '0x' and function signature to recove rhte abi bytecode
  const abiBytecode = `0x${tx.input.slice(10)}`;
  const decoded = web3.eth.abi.decodeParameters(SIGNATURES.PROPOSE_BLOCK, abiBytecode);
  const blockData = decoded['0'];
  const transactionsData = decoded['1'];
  const [
    leafCount,
    proposer,
    root,
    blockNumberL2,
    previousBlockHash,
    frontierHash,
    transactionHashesRoot,
  ] = blockData;
  const block = {
    proposer,
    root,
    leafCount: Number(leafCount),
    blockNumberL2: Number(blockNumberL2),
    previousBlockHash,
    frontierHash,
    transactionHashesRoot,
  };
  const transactions = transactionsData.map(t => {
    const [
      value,
      fee,
      transactionType,
      tokenType,
      historicRootBlockNumberL2,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      proof,
    ] = t;
    const transaction = {
      value,
      fee,
      transactionType,
      tokenType,
      historicRootBlockNumberL2,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
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
  // we no longer put the number of commitments in the on-chain struct but for
  // backwards compatibility, we'll recreate it here.
  block.nCommitments = transactions
    .map(t => t.commitments.filter(c => c !== ZERO))
    .flat(Infinity).length;
  block.transactionHashes = transactions.map(t => t.transactionHash);
  return { block, transactions };
}

export async function getTransactionSubmittedCalldata(eventData) {
  const web3 = Web3.connection();
  const { transactionHash } = eventData;
  const tx = await web3.eth.getTransaction(transactionHash);
  // Remove the '0x' and function signature to recove rhte abi bytecode
  const abiBytecode = `0x${tx.input.slice(10)}`;
  const transactionData = web3.eth.abi.decodeParameter(SIGNATURES.SUBMIT_TRANSACTION, abiBytecode);
  const [
    value,
    fee,
    transactionType,
    tokenType,
    historicRootBlockNumberL2,
    tokenId,
    ercAddress,
    recipientAddress,
    commitments,
    nullifiers,
    compressedSecrets,
    proof,
  ] = transactionData;
  const transaction = {
    fee,
    value,
    transactionType,
    tokenType,
    historicRootBlockNumberL2,
    tokenId,
    ercAddress,
    recipientAddress,
    commitments,
    nullifiers,
    compressedSecrets,
    proof: decompressProof(proof),
  };
  transaction.transactionHash = Transaction.calcHash(transaction);
  return transaction;
}
