import config from 'config';
import logger from '../utils/logger.mjs';
import checkBlock from '../services/check-block.mjs';
import BlockError from '../classes/block-error.mjs';
import createChallenge from '../services/challenges.mjs';
import { removeTransactionsFromMemPool, saveBlock } from '../services/database.mjs';
import mappedBlock from '../event-mappers/block-proposed.mjs';
import { getLeafCount } from '../utils/timber.mjs';

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
const { TIMBER_SYNC_RETRIES } = config;
async function blockProposedEventHandler(data) {
  // convert web3js' version of a struct into our node objects.
  const { block, transactions, currentLeafCount } = mappedBlock(data);

  // Sync Optimist with Timber by checking number of leaves
  for (let i = 0; i < TIMBER_SYNC_RETRIES; i++) {
    const timberLeafCount = await getLeafCount();
    logger.debug(`Timber leaf count was ${timberLeafCount}`);
    // Exponential Backoff
    const backoff = 2 ** i * 1000;
    if (currentLeafCount > timberLeafCount) {
      // Need to wait if the latest leaf count from the block is ahead of Timber
      logger.debug(`Timber doesn't appear synced: Waiting ${backoff}`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      if (i === TIMBER_SYNC_RETRIES) {
        throw new Error('Timber and Optimist appear out of sync');
      }
    } else break;
  }
  logger.info('Received BlockProposed event');
  // await new Promise(resolve => setTimeout(resolve, 2000));
  // TODO this waits to be sure Timber is updated.  Instead write some proper syncing code!
  try {
    // and save the block to facilitate later lookup of block data
    // we will save before checking because when a challenge is raised we need block data to
    // the find transactions that a block holds to mark them unprocessed. In case of check block
    // failure we will delete the block when challenge is accepted and block deleted event is raised
    await saveBlock(block);
    // we'll check the block and issue a challenge if appropriate
    await checkBlock(block, transactions);
    // if the block is, in fact, valid then we also need to mark as used the
    // transactions in the block from our database of unprocessed transactions,
    // so we don't try to use them in a block which we're proposing.
    await removeTransactionsFromMemPool(block); // TODO is await needed?
    // signal to the block-making routines that a block is received: they
    // won't make a new block until their previous one is stored on-chain.
    logger.info('Block Checker - Block was valid');
  } catch (err) {
    if (err instanceof BlockError) {
      logger.warn(`Block Checker - Block invalid, with code ${err.code}! ${err.message}`);
      await createChallenge(block, transactions, err);
    } else throw new Error(err);
  }
}

export default blockProposedEventHandler;
