import WebSocket from 'ws';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Timber from 'common-files/classes/timber.mjs';
import getTimeByBlock from 'common-files/utils/block-info.mjs';
import { enqueueEvent } from 'common-files/utils/event-queue.mjs';
import constants from 'common-files/constants/index.mjs';
import checkBlock from '../services/check-block.mjs';
import BlockError from '../classes/block-error.mjs';
import { createChallenge } from '../services/challenges.mjs';
import {
  removeTransactionsFromMemPool,
  saveBlock,
  stampNullifiers,
  getLatestTree,
  saveTree,
  getTransactionByTransactionHash,
  saveInvalidBlock,
} from '../services/database.mjs';
import { getProposeBlockCalldata } from '../services/process-calldata.mjs';
import { increaseBlockInvalidCounter } from '../services/debug-counters.mjs';
import transactionSubmittedEventHandler from './transaction-submitted.mjs';

const { TIMBER_HEIGHT, HASH_TYPE } = config;
const { ZERO } = constants;

let ws;

export function setBlockProposedWebSocketConnection(_ws) {
  ws = _ws;
}

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data) {
  const { blockNumber: currentBlockCount, transactionHash: transactionHashL1 } = data;
  const { block, transactions } = await getProposeBlockCalldata(data);

  // If a service is subscribed to this websocket and listening for events.
  if (ws && ws.readyState === WebSocket.OPEN) {
    await ws.send(
      JSON.stringify({
        type: 'blockProposed',
        data: {
          blockNumber: currentBlockCount,
          transactionHash: transactionHashL1,
          block,
          transactions,
        },
      }),
    );
  }
  logger.info('Received BlockProposed event');
  try {
    // We get the L1 block time in order to save it in the database to have this information available
    let timeBlockL2 = await getTimeByBlock(transactionHashL1);
    timeBlockL2 = new Date(timeBlockL2 * 1000);
    // and save the block to facilitate later lookup of block data
    // we will save before checking because the database at any time should reflect the state the blockchain holds
    // when a challenge is raised because the is correct block data, then the corresponding block deleted event will
    // update this collection
    await saveBlock({ blockNumber: currentBlockCount, transactionHashL1, timeBlockL2, ...block });

    // It's possible that some of these transactions are new to us. That's because they were
    // submitted by someone directly to another proposer and so there was never a TransactionSubmitted
    // event associated with them. Either that, or we lost our database and had to resync from the chain.
    // In which case this handler is being called be the resync code. either way, we need to add the transaction.
    // let's use transactionSubmittedEventHandler to do this because it will perform all the duties associated
    // with saving a transaction.
    await Promise.all(
      transactions.map(async tx => {
        if (!(await getTransactionByTransactionHash(tx.transactionHash))) {
          logger.debug(
            `Processing external offchain transaction with L2 hash ${tx.transactionHash}`,
          );
          return transactionSubmittedEventHandler({
            blockNumberL2: block.blockNumberL2,
            mempool: false,
            offchain: true,
            ...tx,
          }); // must be offchain or we'll have seen them, mempool = false
        }
        return true;
      }),
    );

    // Update the nullifiers we have stored, with the blockhash. These will
    // be deleted if the block check fails and we get a rollback.  We do this
    // before running the block check because we want to delete the nullifiers
    // asociated with a failed block, and we can't do that if we haven't
    // associated them with a blockHash.
    await stampNullifiers(
      transactions.map(tx => tx.nullifiers.filter(nulls => nulls !== ZERO)).flat(Infinity),
      block.blockHash,
    );
    // mark transactions so that they are out of the mempool,
    // so we don't try to use them in a block which we're proposing.
    await removeTransactionsFromMemPool(block.transactionHashes, block.blockNumberL2, timeBlockL2); // TODO is await needed?

    const latestTree = await getLatestTree();
    const blockCommitments = transactions
      .map(t => t.commitments.filter(c => c !== ZERO))
      .flat(Infinity);
    const updatedTimber = Timber.statelessUpdate(
      latestTree,
      blockCommitments,
      HASH_TYPE,
      TIMBER_HEIGHT,
    );
    const res = await saveTree(currentBlockCount, block.blockNumberL2, updatedTimber);
    logger.debug(`Saving tree with block number ${block.blockNumberL2}, ${res}`);
    // signal to the block-making routines that a block is received: they
    // won't make a new block until their previous one is stored on-chain.
    // we'll check the block and issue a challenge if appropriate
    await checkBlock(block, transactions);
    logger.info('Block Checker - Block was valid');
  } catch (err) {
    if (err instanceof BlockError) {
      logger.warn(`Block Checker - Block invalid, with code ${err.code}! ${err.message}`);
      logger.info(`Block is invalid, stopping any block production`);
      // We enqueue an event onto the stopQueue to halt block production.
      // This message will not be printed because event dequeuing does not run the job.
      // This is fine as we are just using it to stop running.
      increaseBlockInvalidCounter();
      saveInvalidBlock({
        invalidCode: err.code,
        invalidMessage: err.message,
        blockNumber: currentBlockCount,
        transactionHashL1,
        ...block,
      });
      await enqueueEvent(() => logger.info('Stop Until Rollback'), 2);
      await createChallenge(block, transactions, err);
    } else {
      logger.error(err.stack);
      throw new Error(err);
    }
  }
}

export default blockProposedEventHandler;
