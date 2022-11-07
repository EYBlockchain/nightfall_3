/**
Function to retreive calldata associated with a blockchain event.
This is used, rather than re-emmiting the calldata in the event because it's
much cheaper, although the offchain part is more complex.
*/
import config from 'config';
import Web3 from '@polygon-nightfall/common-files/utils/web3.mjs';
import Transaction from '@polygon-nightfall/common-files/classes/transaction.mjs';
import { decompressProof } from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import gen from 'general-number';

const { SIGNATURES } = config;
const { generalise } = gen;

async function getProposeBlockCalldata(eventData) {
  const web3 = Web3.connection();
  const { transactionHash } = eventData;
  const tx = await web3.eth.getTransaction(transactionHash);
  // Remove the '0x' and function signature to recove rhte abi bytecode
  const abiBytecode = `0x${tx.input.slice(10)}`;
  const decoded = web3.eth.abi.decodeParameters(SIGNATURES.PROPOSE_BLOCK, abiBytecode);
  const blockData = decoded['0'];
  const transactionsData = decoded['1'];
  const [packedBlockInfo, root, previousBlockHash, frontierHash, transactionHashesRoot] = blockData;

  const packedInfoHex = generalise(packedBlockInfo).hex(32).slice(2);

  const leafCount = generalise(`0x${packedInfoHex.slice(0, 8)}`).hex(4);
  const blockNumberL2 = generalise(`0x${packedInfoHex.slice(8, 24)}`).hex(8);
  const proposer = generalise(`0x${packedInfoHex.slice(24, 64)}`).hex(20);

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

    const { value, fee, circuitHash, tokenType } = Transaction.unpackInfo(packedTransactionInfo);

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
