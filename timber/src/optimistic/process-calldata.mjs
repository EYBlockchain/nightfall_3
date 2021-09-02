/**
Function to retreive calldata associated with a blockchain event.
This is used, rather than re-emmiting the calldata in the event because it's
much cheaper, although the offchain part is more complex.
*/
import config from 'config';
import Web3 from '../web3.mjs';
import logger from '../logger.mjs';

async function getProposeBlockCalldata(eventData) {
  logger.debug(`Getting calldata, with eventData ${JSON.stringify(eventData, null, 2)}`);
  const web3 = Web3.connection();
  const { transactionHash } = eventData;
  const tx = await web3.eth.getTransaction(transactionHash);
  logger.debug(`found transaction with hash ${transactionHash}`);
  // Remove the '0x' and function signature to recove rhte abi bytecode
  const abiBytecode = `0x${tx.input.slice(10)}`;
  const typesArray = config.PROPOSE_BLOCK_TYPES;
  const decoded = web3.eth.abi.decodeParameters(typesArray, abiBytecode);
  const blockData = decoded['0'];
  const transactionsData = decoded['1'];
  const [leafCount, proposer, root, blockNumberL2, previousBlockHash] = blockData;
  const block = { proposer, root, leafCount, blockNumberL2, previousBlockHash };

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
      proof,
    };
    return transaction;
  });
  return { block, transactions };
}

export default getProposeBlockCalldata;
