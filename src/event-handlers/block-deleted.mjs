/**
Each time the Shield contract removes a block from the blockHash linked-list,
as a result of a rollback, this event gets fired.  We can use it to remove the
same blocks from our local database record and to reset cached Frontier and
leafCount values in the Block class
*/
import {
  addTransactionsToMemPool,
  deleteBlock,
  getBlockByBlockHash,
  getBlockByTransactionHash,
  resetNullifiers,
} from '../services/database.mjs';
import Block from '../classes/block.mjs';
import logger from '../utils/logger.mjs';

async function blockDeletedEventHandler(data) {
  const { blockHash } = data.returnValues;
  logger.info(`Received BlockDeleted event, with hash ${blockHash}`);
  // find the block
  const block = await getBlockByBlockHash(blockHash);
  // move the transactions contained in the block back into the mempool
  // If any transaction already exists in a prior block then don't add it back to mempool
  // TODO chait handle block deleting after various kinds of challenges
  await Promise.all(
    block.transactionHashes.map(async (transactionHash, index) => {
      if ((await getBlockByTransactionHash(transactionHash, true)) !== null)
        delete block.transactionHashes[index];
    }),
  );
  // TODO remove the following check with by adding transaction checker here
  await addTransactionsToMemPool(block);
  // the delete the block
  deleteBlock(blockHash);
  // unset blockhashes for nullifiers
  resetNullifiers(blockHash);
  // reset the Block class cached values.
  Block.rollback();
}

export default blockDeletedEventHandler;
