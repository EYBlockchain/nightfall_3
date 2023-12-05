/**
Function to retreive calldata associated with a blockchain event.
This is used, rather than re-emmiting the calldata in the event because it's
much cheaper, although the offchain part is more complex.
*/
import config from 'config';
import Web3 from 'common-files/utils/web3.mjs';
import logger from 'common-files/utils/logger.mjs';
import Transaction from 'common-files/classes/transaction.mjs';
import { unpackBlockInfo } from 'common-files/utils/block-utils.mjs';

const { SIGNATURES } = config;

async function getProposeBlockCalldata(eventData) {
  const web3 = Web3.connection();
  const { transactionHash } = eventData;
  const tx = await web3.eth.getTransaction(transactionHash);
  if (tx === null) {
    logger.error(
      'The transaction was null. This may be a problem with the blockchain node you are connected to. Make sure it indexes old transactions.  For a Geth node set --txlookuplimit 0',
    );
    throw new Error('transaction retrieved from calldata had null value');
  }
  // Remove the '0x' and function signature to recove rhte abi bytecode
  const abiBytecode = `0x${tx.input.slice(10)}`;
  const decoded = web3.eth.abi.decodeParameters(SIGNATURES.PROPOSE_BLOCK, abiBytecode);
  const blockData = Object.values(decoded['0']).map(value => value.toString());

  const transactionsData = decoded['1'].map(obj =>
    Object.keys(obj) // get all keys of the object
      .sort((a, b) => Number(a) - Number(b)) // sort keys in numeric order
      .filter(key => !isNaN(key)) // we don't want non-numeric keys
      .map(key => {
        return Array.isArray(obj[key]) ? obj[key].map(val => val.toString()) : obj[key].toString();
      }),
  );
  const [packedBlockInfo, root, previousBlockHash, frontierHash, transactionHashesRoot] = blockData;

  const { leafCount, proposer, blockNumberL2 } = unpackBlockInfo(packedBlockInfo);
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
      packedTransactionInfo,
      historicRootBlockNumberL2Packed,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      proof,
    ] = t;

    const { value, fee, circuitHash, tokenType } =
      Transaction.unpackTransactionInfo(packedTransactionInfo);
    const historicRootBlockNumberL2 = Transaction.unpackHistoricRoot(
      nullifiers.length,
      historicRootBlockNumberL2Packed,
    );

    const transaction = {
      value,
      fee,
      circuitHash,
      tokenType,
      historicRootBlockNumberL2,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      compressedSecrets,
      proof,
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
