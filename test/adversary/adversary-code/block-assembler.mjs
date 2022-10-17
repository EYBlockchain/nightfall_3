/* eslint-disable no-await-in-loop, no-unused-vars */

/**
This module does all of the heaving lifting for a Proposer: It assembles blocks
from posted transactions and proposes these blocks.
*/
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { getMostProfitableTransactions } from './database.mjs';
import Block from './block.mjs';

const { TRANSACTIONS_PER_BLOCK } = config;

let count = 0;
async function makeBlock(proposer, number = TRANSACTIONS_PER_BLOCK) {
  logger.debug('Block Assembler - about to make a new block');
  // pick a random number between 0 to 6 (error length - 1)
  const errorIndex = Math.floor(Math.random() * 0);
  // we retrieve un-processed transactions from our local database, relying on
  // the transaction service to keep the database current
  const transactions = await getMostProfitableTransactions(number, count);
  // then we make new block objects until we run out of unprocessed
  // transactions
  const block = await Block.build({ proposer, transactions, errorIndex: count });
  count++;
  return { block, transactions };
}
