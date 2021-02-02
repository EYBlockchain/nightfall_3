/**
This module does all of the heaving lifting for a Proposer: It assembles blocks
from posted transactions and proposes these blocks.
*/
import config from 'config';
import { getMostProfitableTransactions, numberOfUnprocessedTransactions } from './database.mjs';
import Block from '../classes/block.mjs';
import { waitForShield } from '../event-handlers/subscribe.mjs';
import logger from '../utils/logger.mjs';

const { TRANSACTIONS_PER_BLOCK } = config;
let makeBlocks = true;
let blockProposed = '0x0';
let ws;

export function setBlockAssembledWebSocketConnection(_ws) {
  ws = _ws;
}

export function startMakingBlocks() {
  makeBlocks = true;
}
export function stopMakingBlocks() {
  makeBlocks = false;
}

export function setBlockProposed(hash) {
  blockProposed = hash;
}

function isBlockProposed(hash) {
  return hash === blockProposed;
}

export async function makeBlock(proposer, number = TRANSACTIONS_PER_BLOCK) {
  // we retrieve un-processed transactions from our local database, relying on
  // the transaction service to keep the database current
  const transactions = await getMostProfitableTransactions(number);
  // then we make new block objects until we run out of unprocessed
  // transactions
  const currentLeafCount = await (await waitForShield()).methods.leafCount().call();
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
    // if we are the current proposer, and there are enough transactions waiting
    // to be processed, we can assemble a block and create a proposal
    // transaction. If not, we must wait until either we have enough (hooray)
    // or we're no-longer the proposer (boo).
    if ((await numberOfUnprocessedTransactions()) >= TRANSACTIONS_PER_BLOCK && proposer.isMe) {
      const { block, transactions } = await makeBlock(proposer.address);
      logger.info(`New Block created, ${JSON.stringify(block, null, 2)}`);
      // TODO propose this block to the Shield contract here!
      const unsignedProposeBlockTransaction = await (await waitForShield()).methods
        .proposeBlock(block, transactions)
        .encodeABI();
      if (ws) ws.send(unsignedProposeBlockTransaction);
      // Wait until it is proposed to the blockchain before we make any more:
      logger.info('Waiting until block is proposed');
      while (!isBlockProposed(block.blockHash)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // we only get so long to propose this block.  Once we're no-longer the
        // current proposer, we've missed our chance
        if (!proposer.isMe) {
          logger.warn('Our turn as proposer ended before the block was proposed');
          break;
        }
      }
    }
    // slow the loop a bit so we don't hammer the database
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  logger.debug('Stopped making blocks');
}
