/**
Function to retreive calldata associated with a blockchain event.
This is used, rather than re-emmiting the calldata in the event because it's
much cheaper, although the offchain part is more complex.
*/
import config from 'config';
import Web3 from '@polygon-nightfall/common-files/utils/web3.mjs';
import Transaction from '@polygon-nightfall/common-files/classes/transaction.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { decompressProof } from '@polygon-nightfall/common-files/utils/curve-maths/curves.mjs';
import { unpackBlockInfo } from '@polygon-nightfall/common-files/utils/block-utils.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';

const { SIGNATURES } = config;
const { ZERO } = constants;

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

    let proofDecompressed;
    try {
      proofDecompressed = decompressProof(proof);
    } catch (error) {
      logger.warn({ msg: 'The transaction has an invalid proof', proof });
      proofDecompressed = Array(8).fill(ZERO);
    }

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
      proof: proofDecompressed,
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
