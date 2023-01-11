/* eslint-disable no-await-in-loop */

/**
 * This module does all of the heaving lifting for a Proposer: It assembles blocks
 * from posted transactions and proposes these blocks.
 */
import WebSocket from 'ws';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { waitForTimeout } from '@polygon-nightfall/common-files/utils/utils.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import { removeTransactionsFromMemPool, getMempoolTxsSortedByFee } from './database.mjs';
import Block from '../classes/block.mjs';
import { Transaction } from '../classes/index.mjs';
import {
  increaseProposerWsFailed,
  increaseProposerWsClosed,
  increaseProposerBlockNotSent,
} from './debug-counters.mjs';

const { MAX_BLOCK_SIZE, MINIMUM_TRANSACTION_SLOTS, PROPOSER_MAX_BLOCK_PERIOD_MILIS } = config;
const { STATE_CONTRACT_NAME } = constants;

let ws;
let makeNow = false;
let lastBlockTimestamp = new Date().getTime();
let blockPeriodMs = PROPOSER_MAX_BLOCK_PERIOD_MILIS;

export function setBlockAssembledWebSocketConnection(_ws) {
  ws = _ws;
}

export function setMakeNow(_makeNow = true) {
  makeNow = _makeNow;
}

export function setBlockPeriodMs(timeMs) {
  blockPeriodMs = timeMs;
}

/**
Function to indicate to a listening proposer that a rollback has been completed. This
is of little use at the moment but will enable the proposer to take actions such as
checking they haven't been removed. This function may be a little out of place here but
we need to use the proposer's websocket!
*/
export async function signalRollbackCompleted(data) {
  // check that the websocket exists (it should) and its readyState is OPEN
  // before sending. If not wait until the proposer reconnects
  let tryCount = 0;
  while (!ws || ws.readyState !== WebSocket.OPEN) {
    await waitForTimeout(3000);
    logger.warn(
      `Websocket to proposer is closed for rollback complete.  Waiting for proposer to reconnect`,
    );
    if (tryCount++ > 100) throw new Error(`Websocket to proposer has failed`);
  }
  logger.debug('Rollback completed');
  ws.send(JSON.stringify({ type: 'rollback', data }));
}

/**
 * Function to send rawTransction to listening proposer so that proposer can sign
 *  and submit the transaction.
 * @param rawTransaction
 */
export async function sendRawTransactionToWebSocket(rawTransaction) {
  console.log('-------proposer---sendRawTransactionToWebSocket-', rawTransaction);
  // check that the websocket exists (it should) and its readyState is OPEN
  // before sending. If not wait until the proposer reconnects
  let tryCount = 0;
  while (!ws || ws.readyState !== WebSocket.OPEN) {
    await waitForTimeout(3000);
    logger.warn(
      `Websocket to proposer is closed for sending tx.  Waiting for proposer to reconnect`,
    );
    if (tryCount++ > 100) throw new Error(`Websocket to proposer has failed`);
  }
  ws.send(JSON.stringify({ type: 'rawTransaction', txDataToSign: rawTransaction }));
}

async function makeBlock(proposer, transactions) {
  logger.debug('Block Assembler - about to make a new block');
  // then we make new block objects until we run out of unprocessed transactions
  return Block.build({ proposer, transactions });
}

/**
 * This function will make a block iff I am the proposer and there are enough
 * transactions in the database to assembke a block from. It loops until told to
 * stop making blocks. It is called from the 'main()' routine to start it, and
 * should not be called from anywhere else because we only want one instance ever
 */
export async function conditionalMakeBlock(proposer) {
  /*
    if we are the current proposer, and there are enough transactions waiting
    to be processed, we can assemble a block and create a proposal
    transaction. If not, we must wait until either we have enough (hooray)
    or we're no-longer the proposer (boo).
   */

  logger.info(`I am the current proposer: ${proposer.isMe}`);

  if (proposer.isMe) {
    logger.info({
      msg: 'The maximum size of the block is',
      blockSize: MAX_BLOCK_SIZE,
      blockPeriodMs,
      makeNow,
    });

    // Get all the mempool transactions sorted by fee
    const mempoolTransactions = await getMempoolTxsSortedByFee();

    // Map each mempool transaction to their byte size
    const mempoolTransactionSizes = mempoolTransactions.map(tx => {
      const txSlots =
        MINIMUM_TRANSACTION_SLOTS +
        tx.nullifiers.length +
        Math.ceil(tx.historicRootBlockNumberL2.length / 4) +
        tx.commitments.length;

      return txSlots * 32;
    });

    // Calculate the total number of bytes that are in the mempool
    const totalBytes = mempoolTransactionSizes.reduce((acc, curr) => acc + curr, 0);
    const currentTime = new Date().getTime();

    logger.info({
      msg: 'In the mempool there are the following number of transactions',
      numberTransactions: mempoolTransactions.length,
      totalBytes,
    });

    const transactionBatches = [];
    if (totalBytes > 0) {
      let bytesSum = 0;
      for (let i = 0; i < mempoolTransactionSizes.length; ++i) {
        if (bytesSum + mempoolTransactionSizes[i] > MAX_BLOCK_SIZE) {
          bytesSum = mempoolTransactionSizes[i];
          transactionBatches.push(i);
        } else {
          bytesSum += mempoolTransactionSizes[i];
        }
      }

      if (
        transactionBatches.length === 0 &&
        (makeNow || (blockPeriodMs > 0 && currentTime - lastBlockTimestamp >= blockPeriodMs))
      ) {
        transactionBatches.push(mempoolTransactionSizes.length);
      }
    }

    logger.info({
      msg: 'The proposer can create the following number of blocks',
      transactionBatches: transactionBatches.length,
    });

    if (transactionBatches.length >= 1) {
      lastBlockTimestamp = currentTime;
      // TODO set an upper limit to numberOfProposableL2Blocks because a proposer
      /*
        might not be able to submit a large number of blocks before the next proposer becomes
        the current proposer. In this case, this proposer's transactions will still be mined but
        the transactions will fail and proposer will lose gas fees
      */
      logger.debug({
        msg: 'Block Assembler will create blocks at once',
        numberBlocks: transactionBatches.length,
      });

      for (let i = 0; i < transactionBatches.length; i++) {
        // we retrieve un-processed transactions from our local database, relying on
        // the transaction service to keep the database current

        const start = i === 0 ? 0 : transactionBatches[i - 1];
        const end = transactionBatches[i];

        const transactions = mempoolTransactions.slice(start, end);

        makeNow = false; // reset the makeNow so we only make one block with a short number of transactions

        const block = await makeBlock(proposer.address, transactions);

        const blockSize = mempoolTransactionSizes
          .slice(start, end)
          .reduce((acc, curr) => acc + curr, 0);

        logger.info({
          msg: 'Block Assembler - New Block created',
          block,
          blockSize,
        });

        // propose this block to the Shield contract here
        const unsignedProposeBlockTransaction = await (
          await waitForContract(STATE_CONTRACT_NAME)
        ).methods
          .proposeBlock(
            Block.buildSolidityStruct(block),
            transactions.map(t => Transaction.buildSolidityStruct(t)),
          )
          .encodeABI();

        // check that the websocket exists (it should) and its readyState is OPEN
        // before sending Proposed block. If not wait until the proposer reconnects
        let count = 0;
        while (!ws || ws.readyState !== WebSocket.OPEN) {
          await waitForTimeout(3000); // eslint-disable-line no-await-in-loop

          logger.warn(`Websocket to proposer is closed. Waiting for proposer to reconnect`);

          increaseProposerWsClosed();
          if (count++ > 100) {
            increaseProposerWsFailed();

            logger.error(`Websocket to proposer has failed. Returning...`);
            return;
          }
        }

        if (ws && ws.readyState === WebSocket.OPEN) {
          await ws.send(
            JSON.stringify({
              type: 'block',
              txDataToSign: unsignedProposeBlockTransaction,
              block,
              transactions,
            }),
          );
          logger.debug('Send unsigned block-assembler transactions to ws client');
        } else {
          increaseProposerBlockNotSent();

          if (ws) logger.debug({ msg: 'Block not sent', socketState: ws.readyState });
          else logger.debug('Block not sent. Non-initialized socket');
        }

        // remove the transactions from the mempool so we don't keep making new
        // blocks with them
        await removeTransactionsFromMemPool(block.transactionHashes);
      }
    }
  }
  // Let's slow down here so we don't slam the database.
  await waitForTimeout(3000);
}
