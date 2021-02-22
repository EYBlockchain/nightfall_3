/**
Each time the Shield contract removes a block from the blockHash linked-list,
as a result of a rollback, this event gets fired.  We can use it to remove the
same blocks from our local database record.
*/
import {
  addTransactionsToMemPool,
  deleteBlock,
  getBlockByBlockHash,
} from '../services/database.mjs';
import logger from '../utils/logger.mjs';

async function blockDeletedEventHandler(data) {
  const { blockHash } = data.returnValues;
  logger.info(`Received BlockDeleted event, with hash ${blockHash}`);
  // find the block
  const block = await getBlockByBlockHash(blockHash);
  // move the transactions contained in the block back into the mempool
  await addTransactionsToMemPool(block);
  // the delete the block
  deleteBlock(blockHash);
}

export default blockDeletedEventHandler;
