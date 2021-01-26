import logger from '../utils/logger.mjs';
import checkBlock from '../services/check-block.mjs';
import BlockError from '../classes/block-error.mjs';
/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data) {
  const { b: block, t: transactions } = data.returnValues;
  logger.info('Received BlockProposed event');
  try {
    await checkBlock(block, transactions);
    logger.info('Block was valid');
  } catch (err) {
    if (err instanceof BlockError)
      logger.warn(`Block invalid, with code ${err.code}! ${err.message}`);
    else throw new Error(err);
  }
}

export default blockProposedEventHandler;
