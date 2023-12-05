/* eslint-disable import/no-cycle */
import WebSocket from 'ws';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Timber from 'common-files/classes/timber.mjs';
import { getTimeByBlock } from 'common-files/utils/block-utils.mjs';
import { enqueueEvent, queues } from 'common-files/utils/event-queue.mjs';
import constants from 'common-files/constants/index.mjs';
import { checkBlock } from '../services/check-block.mjs';
import BlockError from '../classes/block-error.mjs';
import { createChallenge, commitToChallenge } from '../services/challenges.mjs';
import {
  saveBlock,
  getTreeByBlockNumberL2,
  saveTree,
  saveInvalidBlock,
  deleteDuplicateCommitmentsAndNullifiersFromMemPool,
  saveTransaction,
  getNumberOfL2Blocks,
  getTransactionByTransactionHash,
  updateTransaction,
} from '../services/database.mjs';
import { getProposeBlockCalldata } from '../services/process-calldata.mjs';
import { increaseBlockInvalidCounter } from '../services/debug-counters.mjs';
import { syncState } from '../services/state-sync.mjs';
import Proposer from '../classes/proposer.mjs';

const { TIMBER_HEIGHT, HASH_TYPE } = config;
const { ZERO } = constants;

let ws;
// Stores latest L1 block correctly synchronized to speed possible resyncs
let lastInOrderL1Block = 'earliest';
// Counter to monitor resync attempts in case something is wrong we can force a
//   full resync
let consecutiveResyncAttempts = 0;

export function setBlockProposedWebSocketConnection(_ws) {
  ws = _ws;
}

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data) {
  const { blockNumber: currentBlockCount, transactionHash: transactionHashL1 } = data;
  const { block, transactions } = await getProposeBlockCalldata(data);
  const nextBlockNumberL2 = await getNumberOfL2Blocks();

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

  logger.debug({
    msg: 'Received BlockProposed event',
    receivedBlockNumberL2: block.blockNumberL2,
    expectedBlockNumberL2: nextBlockNumberL2,
    transactions,
  });

  // Check resync attempts
  if (consecutiveResyncAttempts > 10) {
    lastInOrderL1Block = 'earliest';
    consecutiveResyncAttempts = 0;
  }

  // If an out of order L2 block is detected,
  // WARNING: if we ever reach this scenario, this optimist may have built a block based
  //  in an incorrect state and will be challengeable
  if (block.blockNumberL2 > nextBlockNumberL2) {
    consecutiveResyncAttempts++;
    logger.debug('Resyncing...');
    const proposer = new Proposer();
    await syncState(proposer, lastInOrderL1Block);
  }

  lastInOrderL1Block = currentBlockCount;

  // We get the L1 block time in order to save it in the database to have this information available
  let timeBlockL2 = await getTimeByBlock(transactionHashL1);
  timeBlockL2 = new Date(Number(timeBlockL2) * 1000);
  try {
    // save the block to facilitate later lookup of block data
    // we will save before checking because the database at any time should reflect the state the blockchain holds
    // when a challenge is raised because the is correct block data, then the corresponding block deleted event will
    // update this collection
    await saveBlock({
      blockNumber: Number(currentBlockCount),
      transactionHashL1,
      timeBlockL2,
      ...block,
    });

    // It's possible that some of these transactions are new to us. That's because they were
    // submitted by someone directly to another proposer and so there was never a TransactionSubmitted
    // event associated with them. Either that, or we lost our database and had to resync from the chain.
    // In which case this handler is being called be the resync code. either way, we need to add the transaction.
    // What we don't want to do is to overwrite a transaction with a duplicate one in an earlier block, so we check for
    // duplicates and only update the stored transaction if the transaction was not previously in a block, but is now.
    transactions.map(async tx => {
      const transaction = { ...tx, blockNumberL2: block.blockNumberL2, mempool: false };
      try {
        await saveTransaction(transaction);
      } catch (err) {
        if (err.message.includes('E11000')) {
          const storedTx = await getTransactionByTransactionHash(transaction.transactionHash);
          // We should only update the blockNumberL2 of the transaction if it doesn't have one, i.e it's -1
          if (Number(storedTx.blockNumberL2) === -1) {
            await updateTransaction(transaction.transactionHash, {
              blockNumberL2: transaction.blockNumberL2,
              mempool: transaction.mempool,
            });
            logger.info(`Updated stored transaction with L2 block information`);
          } else logger.warn(`Duplicate transaction in Proposed Block has been dropped`);
        } else throw new Error(err);
      }
    });

    const blockCommitments = transactions
      .map(t => t.commitments.filter(c => c !== ZERO))
      .flat(Infinity);
    const blockNullifiers = transactions
      .map(t => t.nullifiers.filter(c => c !== ZERO))
      .flat(Infinity);

    await deleteDuplicateCommitmentsAndNullifiersFromMemPool(
      blockCommitments,
      blockNullifiers,
      block.transactionHashes,
    );

    const latestTree = await getTreeByBlockNumberL2(block.blockNumberL2 - 1);
    const updatedTimber = Timber.statelessUpdate(
      latestTree,
      blockCommitments,
      HASH_TYPE,
      TIMBER_HEIGHT,
    );
    const blockNumber = Number(currentBlockCount);
    const res = await saveTree(blockNumber, block.blockNumberL2, updatedTimber);
    logger.debug(`Saving tree with block number ${block.blockNumberL2}, ${res}`);
    // signal to the block-making routines that a block is received: they
    // won't make a new block until their previous one is stored on-chain.
    // we'll check the block and issue a challenge if appropriate
    // we should not check the block if the stop queue is not empty because
    // it signals that there is a bad block which will get challenged eventually
    // meanwhile any new L2 blocks received if turned out to be bad blocks will
    // raise a commit to challenge and reveal challenge which is bound to fail because
    // a rollback from previous wrong block would have removed this anyway.
    // Instead, what happens now is that any good/bad blocks on top of the first bad block
    // will get saved and eventually all these blocks will be removed as part of the rollback
    // of the first bad block
    if (queues[2].length === 0) await checkBlock(block, transactions);
    logger.info('Block Checker - Block was valid');
  } catch (err) {
    if (err instanceof BlockError) {
      logger.warn(`Block Checker - Block invalid, with code ${err.code}! ${err.message}`);
      logger.info(`Block is invalid, stopping any block production`);
      // We enqueue an event onto the stopQueue to halt block production.
      // This message will not be printed because event dequeuing does not run the job.
      // This is fine as we are just using it to stop running.
      increaseBlockInvalidCounter();
      await saveInvalidBlock({
        invalidCode: err.code,
        invalidMessage: err.message,
        blockNumber: currentBlockCount,
        transactionHashL1,
        timeBlockL2,
        ...block,
      });
      const txDataToSign = await createChallenge(block, transactions, err);
      // push the challenge into the stop queue.  This will stop blocks being
      // made until the challenge has run and a rollback has happened.  We could
      // push anything into the queue and that would work but it's useful to
      // have the actual challenge to support syncing
      logger.debug('enqueuing event to stop queue');
      await enqueueEvent(commitToChallenge, 2, txDataToSign);
      await commitToChallenge(txDataToSign);
    } else {
      logger.error(err.stack);
      throw new Error(err);
    }
  }
}

export default blockProposedEventHandler;
