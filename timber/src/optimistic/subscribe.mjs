/**
subscribe new block headers.
@param callback - the handler function
@param arg[0] - the name of the contract to listen for
@param arg[1] - the signature of the function to listen for
TODO don't start from fromBlock:null
*/

import logger from '../logger';
import Web3 from '../web3';

async function subscribeToNewblockHeaders(callback, ...args) {
  logger.info('Subscribing to function calls...');
  const { fromBlock, functionCallHandlers } = args[0];
  logger.info(`fromBlock: ${fromBlock}`);
  logger.info(`function calls subscribed: ${JSON.stringify(...Object.keys(functionCallHandlers))}`);
  const web3 = Web3.connection();
  const emitter = await web3.eth.subscribe('newBlockHeaders');
  emitter.on('data', block => {
    if (block.number !== null) callback(block, web3, args);
  });
  logger.debug(`subscribed to new block headers`);
  return emitter;
}

export default subscribeToNewblockHeaders;
