/* eslint-disable no-await-in-loop, no-unused-vars */

/**
This module does all of the heaving lifting for a Proposer: It assembles blocks
from posted transactions and proposes these blocks.
*/
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { getMostProfitableTransactions } from './database.mjs';
import Block from './block.mjs';

const { TRANSACTIONS_PER_BLOCK } = config;

let count = 0;
async function makeBlock(proposer, unprocessed) {
  logger.debug('Block Assembler - about to make a new block');
  // pick a random number between 0 to 6 (error length - 1)
  const errorIndex = Math.floor(Math.random() * 0);
  // we retrieve un-processed transactions from our local database, relying on
  // the transaction service to keep the database current
  const unprocessedTransactions = await getMostProfitableTransactions(unprocessed, count);
  let { blockNumberL2, blockHash } = await getLatestBlockInfo();
  let latestTree = await getLatestTree();
  const blockList = [];
  const transactionsList = [];

  // then we make new block objects until we run out of unprocessed
  // transactions
  for (let i = 0; i < Math.floor(unprocessedTransactions.length / TRANSACTIONS_PER_BLOCK); i++) {
    const transactions = unprocessedTransactions.slice(
      i * TRANSACTIONS_PER_BLOCK,
      (i + 1) * TRANSACTIONS_PER_BLOCK,
    );
    const { block, updatedTimber } = Block.build({
      proposer,
      transactions,
      latestBlockInfo: {
        blockNumberL2,
        blockHash,
      },
      latestTree,
      errorIndex,
    });
    blockList.push(block);
    transactionsList.push(transactions);
    // update blockNumberL2, blockHash and latestTree (timber) of this last block
    blockNumberL2 = block.blockNumberL2;
    blockHash = block.blockHash;
    latestTree = updatedTimber;
  }
  count++;
  return { blockList, transactionsList };
}
