/* eslint-disable no-await-in-loop */

/**
 * This module does all of the heaving lifting for a Proposer: It assembles blocks
 * from posted transactions and proposes these blocks.
 */
import WebSocket from 'ws';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import {
  removeTransactionsFromMemPool,
  removeCommitmentsFromMemPool,
  removeNullifiersFromMemPool,
  getMostProfitableTransactions,
  numberOfUnprocessedTransactions,
} from './database.mjs';
import Block from '../classes/block.mjs';
import { Transaction } from '../classes/index.mjs';
import {
  increaseProposerWsFailed,
  increaseProposerWsClosed,
  increaseProposerBlockNotSent,
} from './debug-counters.mjs';

const { TRANSACTIONS_PER_BLOCK } = config;
const { STATE_CONTRACT_NAME } = constants;

let ws;
let makeNow = false;

export function setBlockAssembledWebSocketConnection(_ws) {
  ws = _ws;
}

export function setMakeNow(_makeNow = true) {
  makeNow = _makeNow;
}

/**
Function to indicate to a listening proposer that a rollback has been completed. This
is of little use at the moment but will enable the proposer to take actions such as
checking they haven't been removed. This function may be a little out of place here but
we need to use the proposer's websocket!
*/
export async function signalRollbackCompleted(data) {
  // check that the websocket exists (it should) and its readyState is OPEN
  // before sending. If not wait until the challenger reconnects
  let tryCount = 0;
  while (!ws || ws.readyState !== WebSocket.OPEN) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // eslint-disable-line no-await-in-loop
    logger.warn(
      `Websocket to proposer is closed for rollback complete.  Waiting for proposer to reconnect`,
    );
    if (tryCount++ > 100) throw new Error(`Websocket to proposer has failed`);
  }
  logger.debug('Rollback completed');
  ws.send(JSON.stringify({ type: 'rollback', data }));
}

async function makeBlock(proposer, number = TRANSACTIONS_PER_BLOCK) {
  logger.debug('Block Assembler - about to make a new block');
  // we retrieve un-processed transactions from our local database, relying on
  // the transaction service to keep the database current
  const transactions = await getMostProfitableTransactions(number);
  // then we make new block objects until we run out of unprocessed transactions
  const block = await Block.build({ proposer, transactions });
  return { block, transactions };
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
  if (proposer.isMe) {
    const unprocessed = await numberOfUnprocessedTransactions();
    let numberOfProposableL2Blocks = Math.floor(unprocessed / TRANSACTIONS_PER_BLOCK);
    // if we want to make a block right now but there aren't enough transactions, this logic
    // tells us to go anyway
    if (makeNow && unprocessed > 0 && numberOfProposableL2Blocks === 0)
      numberOfProposableL2Blocks = 1;

    if (numberOfProposableL2Blocks >= 1) {
      // TODO set an upper limit to numberOfProposableL2Blocks because a proposer
      /*
        might not be able to submit a large number of blocks before the next proposer becomes
        the current proposer. In this case, this proposer's transactions will still be mined but
        the transactions will fail and proposer will lose gas fees
      */
      logger.debug({
        msg: 'Block Assembler will create blocks at once',
        numberOfProposableL2Blocks,
      });

      for (let i = 0; i < numberOfProposableL2Blocks; i++) {
        // work out if this is a normal size block or a short one
        const numberOfTransactionsInBlock =
          unprocessed >= TRANSACTIONS_PER_BLOCK ? TRANSACTIONS_PER_BLOCK : unprocessed;
        makeNow = false; // reset the makeNow so we only make one block with a short number of transactions
        const { block, transactions } = await makeBlock(
          proposer.address,
          numberOfTransactionsInBlock,
        );

        logger.info({
          msg: 'Block Assembler - New Block created',
          block,
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
        let tryCount = 0;
        while (!ws || ws.readyState !== WebSocket.OPEN) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // eslint-disable-line no-await-in-loop

          logger.warn(`Websocket to proposer is closed.  Waiting for proposer to reconnect`);

          increaseProposerWsClosed();
          if (tryCount++ > 100) {
            increaseProposerWsFailed();
            throw new Error(`Websocket to proposer has failed`);
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
        } else if (ws) {
          increaseProposerBlockNotSent();
          logger.debug({ msg: 'Block not sent', socketState: ws.readyState });
        } else {
          increaseProposerBlockNotSent();
          logger.debug('Block not sent. Uinitialized socket');
        }
        // remove the transactions from the mempool so we don't keep making new
        // blocks with them
        await removeTransactionsFromMemPool(block.transactionHashes);
        await removeCommitmentsFromMemPool(
          transactions.map(transaction => transaction.commitments),
        );
        await removeNullifiersFromMemPool(transactions.map(transaction => transaction.commitments));
      }
    }
  }
  // Let's slow down here so we don't slam the database.
  await new Promise(resolve => setTimeout(resolve, 3000));
}
