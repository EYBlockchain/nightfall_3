/**
 * Each time the Shield contract removes a block from the blockHash linked-list,
 * as a result of a rollback, this event gets fired.  We can use it to remove the
 * same blocks from our local database record and to reset cached Frontier and
 * leafCount values in the Block class
 */
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { dequeueEvent, enqueueEvent } from '@polygon-nightfall/common-files/utils/event-queue.mjs';
import {
  addTransactionsToMemPool,
  deleteBlock,
  findBlocksFromBlockNumberL2,
  getTransactionsByTransactionHashesByL2Block,
  deleteTransactionsByTransactionHashes,
  deleteTreeByBlockNumberL2,
} from '../services/database.mjs';
import Block from '../classes/block.mjs';
import { checkTransaction } from '../services/transaction-checker.mjs';
import {
  signalRollbackCompleted as signalRollbackCompletedToChallenger,
  isMakeChallengesEnable,
} from '../services/challenges.mjs';

const { ZERO } = constants;

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
  logger.info({ msg: 'Rollback - rollback layer 2 blocks', blocksToBeDeleted });

  const invalidTransactions = [];
  const validTransactionsBlock = {};

  // For valid transactions that have made it to this point, we run them through our transaction checker for validity
  for (let i = 0; i < blocksToBeDeleted.length; i++) {
    const blockNumber = blocksToBeDeleted[i].blockNumberL2;
    // Add new block to validTransactionsBlock
    validTransactionsBlock[blockNumber] = [];

    // Get the trannsaction hashes included in these blocks
    const transactionHashesInBlock = blocksToBeDeleted[i].transactionHashes.flat(Infinity);
    // Use the transaction hashes to grab the actual transactions filtering out deposits - In Order.
    // eslint-disable-next-line no-await-in-loop
    const blockTransactions = await getTransactionsByTransactionHashesByL2Block(
      transactionHashesInBlock,
      blocksToBeDeleted[i],
    );
    logger.info({
      msg: 'Rollback - blockTransactions to check:',
      blockTransactions,
    });

    const transactionsSortedByFee = blockTransactions.sort((tx1, tx2) =>
      Number(tx1.fee) < Number(tx2.fee) ? 1 : -1,
    );

    const commitmentsList = [];
    const nullifiersList = [];
    for (let j = 0; j < transactionsSortedByFee.length; j++) {
      const transaction = transactionsSortedByFee[j];
      try {
        // eslint-disable-next-line no-await-in-loop
        await checkTransaction(
          transaction,
          { checkInL2Block: true },
          {
            blockNumberL2: blockNumber,
          },
        );

        for (let k = 0; k < transaction.commitments.length; k++) {
          if (commitmentsList.includes(transaction.commitments[k])) {
            throw new Error(
              `The following commitment is duplicated: ${transaction.commitments[k]}`,
            );
          }
        }

        for (let k = 0; k < transaction.nullifiers.length; k++) {
          if (nullifiersList.includes(transaction.nullifiers[k])) {
            throw new Error(`The following nullifier is duplicated: ${transaction.nullifiers[k]}`);
          }
        }

        commitmentsList.push(...transaction.commitments.filter(c => c !== ZERO));
        nullifiersList.push(...transaction.nullifiers.filter(c => c !== ZERO));

        // Add the transaction to the list of valid transactions to be rollbacked
        validTransactionsBlock[blockNumber].push(transaction.transactionHash);
      } catch (error) {
        logger.error({
          msg: `Rollback - Invalid Transaction: ${transaction.transactionHash}`,
          error,
        });

        invalidTransactions.push(transaction.transactionHash);
      }
    }
  }

  // We can now reset or delete the local database.
  logger.debug({
    msg: 'Rollback - Updating Optimist DB',
    validTransactionsBlock,
    invalidTransactions,
  });

  await Promise.all([
    deleteTransactionsByTransactionHashes(invalidTransactions),
    ...Object.keys(validTransactionsBlock)
      .map(async blockL2Number => [
        addTransactionsToMemPool(validTransactionsBlock[blockL2Number], blockL2Number),
        deleteBlock(blockL2Number),
      ])
      .flat(Infinity),
  ]);

  await dequeueEvent(2); // Remove an event from the stopQueue.
  // A Rollback triggers a NewCurrentProposer event which shoudl trigger queue[0].end()
  // But to be safe we enqueue a helper event to guarantee queue[0].end() runs.

  // assumption is if optimist has makeChallenges ON there is challenger
  // websocket client waiting for signal rollback
  if (isMakeChallengesEnable()) await enqueueEvent(() => signalRollbackCompletedToChallenger(), 0);
}

export default rollbackEventHandler;
