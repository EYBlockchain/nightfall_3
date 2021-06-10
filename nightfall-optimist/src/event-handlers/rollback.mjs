/**
Each time the Shield contract removes a block from the blockHash linked-list,
as a result of a rollback, this event gets fired.  We can use it to remove the
same blocks from our local database record and to reset cached Frontier and
leafCount values in the Block class
*/
import {
  addTransactionsToMemPool,
  deleteBlock,
  findBlocksFromBlockNumberL2,
  resetNullifiers,
} from '../services/database.mjs';
import Block from '../classes/block.mjs';
import logger from '../utils/logger.mjs';

async function rollbackEventHandler(data) {
  const { blockNumberL2 } = data.returnValues;
  logger.info(`Received Rollback event, with layer 2 block number ${blockNumberL2}`);
  // reset the Block class cached values.
  Block.rollback();
  // We have to remove all blocks from our database which have a layer 2 block
  // number >= blockNumberL2, because the blockchain will have deleted these due
  // to a successful challenge. First we find and then process them.
  // Return the transactions in the rolled back block to the mempool and
  // unset blockhashes for nullifiers, finally, delete the blocks
  // themselves.
  return Promise.all(
    (await findBlocksFromBlockNumberL2(blockNumberL2))
      .map(async block => [
        addTransactionsToMemPool(block),
        resetNullifiers(block.blockHash),
        deleteBlock(block.blockHash),
      ])
      .flat(1),
  );
}

export default rollbackEventHandler;
