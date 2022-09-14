/**
 * Each time the Shield contract removes a block from the blockHash linked-list,
 * as a result of a rollback, this event gets fired.  We can use it to remove the
 * same blocks from our local database record and to reset cached Frontier and
 * leafCount values in the Block class
 */
import logger from 'common-files/utils/logger.mjs';
import { dequeueEvent, enqueueEvent } from 'common-files/utils/event-queue.mjs';
import {
  addTransactionsToMemPool,
  deleteBlock,
  findBlocksFromBlockNumberL2,
  getTransactionsByTransactionHashes,
  deleteTransactionsByTransactionHashes,
  deleteTreeByBlockNumberL2,
} from '../services/database.mjs';
import {
  checkDuplicateCommitmentsWithinBlock,
  checkDuplicateNullifiersWithinBlock,
} from '../services/check-block.mjs';
import Block from '../classes/block.mjs';
import checkTransaction from '../services/transaction-checker.mjs';
import { signalRollbackCompleted } from '../services/block-assembler.mjs';

async function rollbackEventHandler(data) {
  const { blockNumberL2 } = data.returnValues;

  logger.info({ msg: 'Received Rollback event', blockNumberL2 });

  // reset the Block class cached values.
  Block.rollback();
  await deleteTreeByBlockNumberL2(Number(blockNumberL2));

  /*
  A Rollback occurs when an on-chain fraud proof (challenge) is accepted.
  During a rollback we have to do three things:
  1) Remove the block data from our database from the blockNumberL2 provided in the Rollback Event
  2) Return transactions to the mempool and delete those that may have become invalid as a result of the Rollback.
  */
  // Get all blocks that need to be deleted
  const blocksToBeDeleted = await findBlocksFromBlockNumberL2(blockNumberL2);
  logger.info(`Rollback - rollback layer 2 block ${JSON.stringify(blocksToBeDeleted[0], null, 2)}`);

  const invalidTransactions = [];
  // For valid transactions that have made it to this point, we run them through our transaction checker for validity
  for (let i = 0; i < blocksToBeDeleted.length; i++) {
    // Get the trannsaction hashes included in these blocks
    const transactionHashesInBlock = blocksToBeDeleted[i].transactionHashes.flat(Infinity);
    // Use the transaction hashes to grab the actual transactions filtering out deposits - In Order.
    // eslint-disable-next-line no-await-in-loop
    const blockTransactions = (await getTransactionsByTransactionHashes(transactionHashesInBlock)) // TODO move this to getTransactionsByTransactionHashes by l2 block number because transaction hash is not unique and might not pull the right l2 block number
      .filter(t => t.transactionType !== '0');

    logger.info({
      msg: 'Rollback - blockTransactions to check:',
      blockTransactions: JSON.stringify(blockTransactions),
    });

    for (let j = 0; j < blockTransactions.length; j++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await checkTransaction(blockTransactions[j], false, {
          blockNumberL2: blocksToBeDeleted[i].blockNumberL2,
        });
      } catch (error) {
        logger.error({
          msg: `Rollback - Invalid checkTransaction: ${blockTransactions[j].transactionHash}`,
          error,
        });

        invalidTransactions.push(blockTransactions[j].transactionHash);
      }
    }
    try {
      checkDuplicateCommitmentsWithinBlock(blocksToBeDeleted[i], blockTransactions);
      checkDuplicateNullifiersWithinBlock(blocksToBeDeleted[i], blockTransactions);
    } catch (error) {
      const { transaction2: transaction } = error.metadata; // TODO pick transaction to delete based on which transaction pays more to proposer
      logger.debug(`Rollback - Invalid transaction: ${transaction.transactionHash}`);
      invalidTransactions.push(transaction.transactionHash);
    }
  }

  // We can now reset or delete the local database.
  await Promise.all(
    blocksToBeDeleted
      .map(async block => [addTransactionsToMemPool(block), deleteBlock(block.blockHash)])
      .flat(1),
  );

  logger.debug(`Rollback - Deleting transactions: ${invalidTransactions}`);
  await deleteTransactionsByTransactionHashes(invalidTransactions);

  await dequeueEvent(2); // Remove an event from the stopQueue.
  // A Rollback triggers a NewCurrentProposer event which shoudl trigger queue[0].end()
  // But to be safe we enqueue a helper event to guarantee queue[0].end() runs.
  await enqueueEvent(() => signalRollbackCompleted(), 0);
}

export default rollbackEventHandler;
