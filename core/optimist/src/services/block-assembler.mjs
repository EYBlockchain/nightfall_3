/* eslint-disable no-await-in-loop */

/**
This module does all of the heaving lifting for a Proposer: It assembles blocks
from posted transactions and proposes these blocks.
*/
import WebSocket from 'ws';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import {
  removeTransactionsFromMemPool,
  getMostProfitableTransactions,
  numberOfUnprocessedTransactions,
} from './database.mjs';
import Block from '../classes/block.mjs';
import { Transaction } from '../classes/index.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';

const { TRANSACTIONS_PER_BLOCK, STATE_CONTRACT_NAME } = config;

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
  const block = await Block.build({ proposer, transactions });
  return { block, transactions };
}

/**
This function will make a block iff I am the proposer and there are enough
transactions in the database to assembke a block from. It loops until told to
stop making blocks. It is called from the 'main()' routine to start it, and
should not be called from anywhere else because we only want one instance ever
*/
export async function conditionalMakeBlock(proposer) {
  // if we are the current proposer, and there are enough transactions waiting
  // to be processed, we can assemble a block and create a proposal
  // transaction. If not, we must wait until either we have enough (hooray)
  // or we're no-longer the proposer (boo).
  if (proposer.isMe) {
    const numberOfProposableL2Blocks = Math.floor(
      (await numberOfUnprocessedTransactions()) / TRANSACTIONS_PER_BLOCK,
    );

    if (numberOfProposableL2Blocks >= 1) {
      // TODO set an upper limit to numberOfProposableL2Blocks because a proposer
      // might not be able to submit a large number of blocks before the next proposer becomes
      // the current proposer. In this case, this proposer's transactions will still be mined but
      // the transactions will fail and proposer will lose gas fees
      logger.debug(`Block Assembler will create ${numberOfProposableL2Blocks} blocks at once`);
      for (let i = 0; i < numberOfProposableL2Blocks; i++) {
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
        // TODO - check ws readyState is OPEN => CLOSED .WebSocket.OPEN(1), CONNECTING(0), CLOSING(2), CLOSED(3)
        //  before sending Poposed block. If not Open, try to open it
        if (ws && ws.readyState === WebSocket.OPEN) {
          await ws.send(
            JSON.stringify({
              type: 'block',
              txDataToSign: unsignedProposeBlockTransaction,
              block,
              transactions,
            }),
          );
          logger.debug('Send unsigned block-assembler transaction to ws client');
        } else if (ws) {
          logger.debug('Block not sent. Socket state', ws.readyState);
        } else {
          logger.debug('Block not sent. uinitialized socket');
        }
        // remove the transactions from the mempool so we don't keep making new
        // blocks with them
        await removeTransactionsFromMemPool(block.transactionHashes);
      }
    }
  }
  // Let's slow down here so we don't slam the database.
  await new Promise(resolve => setTimeout(resolve, 3000));
}
