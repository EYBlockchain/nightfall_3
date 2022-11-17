/* eslint-disable no-await-in-loop, no-unused-vars, import/no-cycle */

/**
This module does all of the heaving lifting for a Proposer: It assembles blocks
from posted transactions and proposes these blocks.
*/
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { getMempoolTxsSortedByFee } from './database.mjs';
import Block from './block.mjs';

let count = 0;
async function makeBlock(proposer, transactions) {
  logger.debug('Block Assembler - about to make a new block');
  // we retrieve un-processed transactions from our local database, relying on
  // the transaction service to keep the database current
  const transactionsAdversary = await getMempoolTxsSortedByFee(count);
  // then we make new block objects until we run out of unprocessed
  // transactions
  const block = await Block.build({ proposer, transactionsAdversary, errorIndex: count });
  count++;
  return { block, transactionsAdversary };
}
