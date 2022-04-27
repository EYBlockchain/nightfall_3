// ignore unused exports default

/**
Function to retreive calldata associated with a blockchain event.
This is used, rather than re-emmiting the calldata in the event because it's
much cheaper, although the offchain part is more complex.
*/
import Transaction from '../../common-files/classes/transaction';
import { decompressProof } from '../../common-files/utils/curve-maths/curves';

const { PROPOSE_BLOCK_TYPES } = global.config;

async function getProposeBlockCalldata(eventData) {
  const { transactionHash } = eventData;
  const tx = await web3.getWeb3().eth.getTransaction(transactionHash);
  // Remove the '0x' and function signature to recove rhte abi bytecode
  const abiBytecode = `0x${tx.input.slice(10)}`;
  const decoded = web3.getWeb3().eth.abi.decodeParameters(PROPOSE_BLOCK_TYPES, abiBytecode);
  const blockData = decoded['0'];
  const transactionsData = decoded['1'];
  const [leafCount, proposer, root, blockNumberL2, previousBlockHash] = blockData;
  const block = {
    proposer,
    root,
    leafCount: Number(leafCount),
    blockNumberL2: Number(blockNumberL2),
    previousBlockHash,
  };
  const transactions = transactionsData.map(t => {
    const [
      value,
      historicRootBlockNumberL2,
      transactionType,
      tokenType,
      publicInputHash,
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
      historicRootBlockNumberL2,
      transactionType,
      tokenType,
      publicInputHash,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      proof: decompressProof(proof),
    };
    // note, this transaction is incomplete in that the 'fee' field is empty.
    // that shouldn't matter as it's not needed.
    transaction.transactionHash = Transaction.calcHash(transaction);
    return transaction;
  });
  block.transactionHashes = transactions.map(t => t.transactionHash);

  return { transactions, block };
}

export default getProposeBlockCalldata;
