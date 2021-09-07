/* eslint-disable no-await-in-loop */

/**
This module does all of the heaving lifting for a Proposer: It assembles blocks
from posted transactions and proposes these blocks.
*/
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { getLeafCount } from '../utils/timber.mjs';
import {
  removeTransactionsFromMemPool,
  getMostProfitableTransactions,
  numberOfUnprocessedTransactions,
} from './database.mjs';
import Block from '../classes/block.mjs';
import { Transaction } from '../classes/index.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';
import { nextHigherPiorityQueueHasEmptied } from './event-queue.mjs';

const { TRANSACTIONS_PER_BLOCK, STATE_CONTRACT_NAME } = config;
const makeBlocks = true;
let ws;

export function setBlockAssembledWebSocketConnection(_ws) {
  ws = _ws;
}

async function makeBlock(proposer, number = TRANSACTIONS_PER_BLOCK) {
  logger.debug('Block Assembler - about to make a new block');
  // we retrieve un-processed transactions from our local database, relying on
  // the transaction service to keep the database current
  const transactions = await getMostProfitableTransactions(number);
  // then we make new block objects until we run out of unprocessed
  // transactions
  const currentLeafCount = parseInt(await getLeafCount(), 10);
  const block = await Block.build({ proposer, transactions, currentLeafCount });
  return { block, transactions };
}

/**
This function will make a block iff I am the proposer and there are enough
transactions in the database to assembke a block from. It loops until told to
stop making blocks. It is called from the 'main()' routine to start it, and
should not be called from anywhere else because we only want one instance ever.
*/
export async function conditionalMakeBlock(proposer) {
  logger.debug('Ready to make blocks');
  while (makeBlocks) {
    logger.silly('Block Assembler is waiting for transactions');
    await nextHigherPiorityQueueHasEmptied(1); // i.e. the highest priority queue is empty
    // if we are the current proposer, and there are enough transactions waiting
    // to be processed, we can assemble a block and create a proposal
    // transaction. If not, we must wait until either we have enough (hooray)
    // or we're no-longer the proposer (boo).
    if ((await numberOfUnprocessedTransactions()) >= TRANSACTIONS_PER_BLOCK && proposer.isMe) {
      const { block, transactions } = await makeBlock(proposer.address);
      logger.info(`Block Assembler - New Block created, ${JSON.stringify(block, null, 2)}`);
      // propose this block to the Shield contract here
      const unsignedProposeBlockTransaction = await (
        await waitForContract(STATE_CONTRACT_NAME)
      ).methods
        .proposeBlock(
          Block.buildSolidityStruct(block),
          transactions.map(t => Transaction.buildSolidityStruct(t)),
        )
        .encodeABI();
      if (ws)
        ws.send(
          JSON.stringify({
            type: 'block',
            txDataToSign: unsignedProposeBlockTransaction,
            block,
            transactions,
          }),
        );
      logger.debug('Send unsigned block-assembler transaction to ws client');
      // remove the transactiosn from the mempool so we don't keep making new
      // blocks with them
      await removeTransactionsFromMemPool(block); // TODO is await needed?
    }
    // slow the loop a bit so we don't hammer the database
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  logger.debug('Stopped making blocks');
}
