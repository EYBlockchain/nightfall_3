/**
Function to retreive calldata associated with a blockchain event.
This is used, rather than re-emmiting the calldata in the event because it's
much cheaper, although the offchain part is more complex.
*/
import Web3 from '../web3';
import logger from '../logger';

async function getProposeBlockCalldata(eventData) {
  logger.debug(`Getting calldata, with eventData ${JSON.stringify(eventData, null, 2)}`);
  const web3 = Web3.connection();
  const { transactionHash } = eventData;
  const tx = await web3.eth.getTransaction(transactionHash);
  logger.debug(`found transaction with hash ${transactionHash}`);
  // Remove the '0x' and function signature to recove rhte abi bytecode
  const abiBytecode = `0x${tx.input.slice(10)}`;
  const typesArray = [
    '(address,bytes32,uint64,uint64)',
    '(uint64,uint8,bytes32,bytes32,bytes32,bytes32,bytes32[2],bytes32[2],bytes32,uint[4])[]',
  ];
  const decoded = web3.eth.abi.decodeParameters(typesArray, abiBytecode);
  const blockData = decoded['0'];
  const transactionsData = decoded['1'];
  const [proposer, root, leafCount, nCommitments] = blockData;
  const block = { proposer, root, leafCount, nCommitments };
  const transactions = transactionsData.map(t => {
    const [
      value,
      transactionType,
      publicInputHash,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      historicRoot,
      proof,
    ] = t;
    const transaction = {
      value,
      transactionType,
      publicInputHash,
      tokenId,
      ercAddress,
      recipientAddress,
      commitments,
      nullifiers,
      historicRoot,
      proof,
    };
    return transaction;
  });
  return { block, transactions };
}

export default getProposeBlockCalldata;
