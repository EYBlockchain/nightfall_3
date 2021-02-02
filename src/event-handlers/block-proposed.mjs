import logger from '../utils/logger.mjs';
import checkBlock from '../services/check-block.mjs';
import BlockError from '../classes/block-error.mjs';
import { removeTransactions } from '../services/database.mjs';
import mappedBlock from '../event-mappers/block-proposed.mjs';
import { setBlockProposed } from '../services/propose-block.mjs';
/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data) {
  // convert web3js' version of a struct into our node objects.
  const { block, transactions } = mappedBlock(data);
  logger.info('Received BlockProposed event');
  try {
    // we'll check the block and issue a challenge if appropriate
    await checkBlock(block, transactions);
    // if the block is, in fact, valid then we also need to remove the
    // transactions in the block from our database of unprocessed transactions,
    // so we don't try to use them in a block which we're proposing.
    await removeTransactions(block);
    // signal to the block-making routines that the block is received
    setBlockProposed(block.blockHash);
    logger.info('Block was valid');
  } catch (err) {
    if (err instanceof BlockError)
      // ooh - TODO need to issue a challenge here!
      logger.warn(`Block invalid, with code ${err.code}! ${err.message}`);
    else throw new Error(err);
  }
}

export default blockProposedEventHandler;
