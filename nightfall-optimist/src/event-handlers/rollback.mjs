/**
Each time the Shield contract removes a block from the blockHash linked-list,
as a result of a rollback, this event gets fired.  We can use it to remove the
same blocks from our local database record and to reset cached Frontier and
leafCount values in the Block class
*/
import logger from 'common-files/utils/logger.mjs';
import {
  addTransactionsToMemPool,
  deleteBlock,
  findBlocksFromBlockNumberL2,
  deleteNullifiers,
  deleteTransferAndWithdraw,
} from '../services/database.mjs';
import Block from '../classes/block.mjs';

async function rollbackEventHandler(data) {
  const { blockNumberL2 } = data.returnValues;
  logger.info(`Received Rollback event, with layer 2 block number ${blockNumberL2}`);
  // reset the Block class cached values.
  Block.rollback();
  /*
   We have to remove all blocks from our database which have a layer 2 block
   number >= blockNumberL2, because the blockchain will have deleted these due
   to a successful challenge. First we find and then process them.
   Return deposit transactions in the rolled back block to the mempool so that
   they can be picked up again by a new Proposer, but delete transfer and
   withdraw transactions because we cannot guarantee that these won't be re-
   proposed before the corresponding transaction that creates the input
   commitments.  If that were to happen, the block would become challengable
   even if the Proposer acted in good faith.  Deleteing them obvously prevents
   this but means that the Transactor looses their fee payment.  TODO fix this,
   but for now it will do because the fee isn't much and this should be a rare
   event.
   Also delete nullifiers and the blocks that no longer exist.
  */
  return Promise.all(
    (await findBlocksFromBlockNumberL2(blockNumberL2))
      .map(async block => [
        deleteTransferAndWithdraw(block.transactionHashes).then(() =>
          addTransactionsToMemPool(block),
        ),
        deleteNullifiers(block.blockHash),
        deleteBlock(block.blockHash),
      ])
      .flat(1),
  );
}

export default rollbackEventHandler;
