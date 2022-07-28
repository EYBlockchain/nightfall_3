/**
Function to retreive block timestamp of a transaction.
*/
import Web3 from './web3.mjs';

async function getTimeByBlock(txHash) {
  const web3 = Web3.connection();
  const blockN = await web3.eth.getTransaction(txHash);
  const blockData = await web3.eth.getBlock(blockN.blockNumber);

  return blockData.timestamp;
}

export default getTimeByBlock;
