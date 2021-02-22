import logger from '../utils/logger.mjs';
import checkBlock from '../services/check-block.mjs';
import BlockError from '../classes/block-error.mjs';
import createChallenge from '../services/challenges.mjs';
import { removeTransactions, saveBlock } from '../services/database.mjs';
import mappedBlock from '../event-mappers/block-proposed.mjs';
import { setBlockProposed } from '../services/propose-block.mjs';
/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data) {
  // convert web3js' version of a struct into our node objects.
  const { block, transactions } = mappedBlock(data);
  logger.info('Received BlockProposed event');
  // TODO this waits to be sure Timber is updated.  Instead write some proper syncing code!
  await new Promise(resolve => setTimeout(resolve, 5000));
  try {
    // we'll check the block and issue a challenge if appropriate
    setBlockProposed(block.blockHash); // TODO to move this after check block
    await checkBlock(block, transactions);
    // if the block is, in fact, valid then we also need to remove the
    // transactions in the block from our database of unprocessed transactions,
    // so we don't try to use them in a block which we're proposing.
    await removeTransactions(block); // TODO is await needed?
    // and save the block to facilitate later lookup of block data
    await saveBlock(block);
    // signal to the block-making routines that the block is received: they
    // won't make a new block until their previous one is stored on-chain.
    logger.info('Block was valid');
  } catch (err) {
    if (err instanceof BlockError) await createChallenge(block, transactions, err);
    // TODO remove transactions
    else throw new Error(err);
  }
}

export default blockProposedEventHandler;
