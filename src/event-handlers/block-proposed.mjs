import logger from '../utils/logger.mjs';
import checkBlock from '../services/check-block.mjs';
import BlockError from '../classes/block-error.mjs';
import createChallenge from '../services/challenges.mjs';

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
    if (err instanceof BlockError) {
      await createChallenge(block, transactions, err);
    } else throw new Error(err);
  }
}

export default blockProposedEventHandler;
