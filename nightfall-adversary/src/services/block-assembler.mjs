/* eslint-disable no-await-in-loop */

/**
This module does all of the heaving lifting for a Proposer: It assembles blocks
from posted transactions and proposes these blocks.
*/
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import {
  removeTransactionsFromMemPool,
  getMostProfitableTransactions,
  numberOfUnprocessedTransactions,
} from './database.mjs';
import Block from '../classes/block.mjs';
import InvalidBlock from '../classes/invalid-block.mjs';
import { Transaction } from '../classes/index.mjs';
import { waitForContract } from '../event-handlers/subscribe.mjs';

let blockConfig = [];

export function concatBlockConfig(newConfig) {
  blockConfig = blockConfig.concat(newConfig);
}

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

  // count number of transfer and withdraw transactions if any
  const anyTransferWithdraw = transactions.reduce((counter, { transactionType }) => {
    // eslint-disable-next-line no-param-reassign
    if (transactionType === 1 || transactionType === 2 || transactionType === 3) counter += 1;
    return counter;
  });
  // count number of ERC20 or ERC721 token transactions if any
  const anyERC20ERC721 = transactions.reduce((counter, { tokenType }) => {
    // eslint-disable-next-line no-param-reassign
    if (tokenType === 0 || tokenType === 1) counter += 1;
    return counter;
  });

  let block;
  // then we make new block objects until we run out of unprocessed
  // transactions. Some of these will be valid and some will be invalid blocks
  // based on block config array provided. This will be processed in a FIFO manner
  // If the block config is empty or contains ValidBlock, then we will build blocks.
  // Otherwise we will build invalid blocks based on the specified bad block type
  if (blockConfig.length === 0 || blockConfig[0] === 'ValidBlock') {
    block = await Block.build({ proposer, transactions });
  }
  // If IncorrectHistoricRoot or DuplicateNullifier is to be processed and there are
  // no transfer or withdraw transactions retrieved from getMostProfitableTransactions,
  // then we swap this error type with the one that comes after it in the block config
  // We do the same, if InvalidTransaction is received and there are no ERC20 or ERC1155
  // transactions retrieved
  // In case it is handled on a high level such that makeBlock never receives
  // IncorrectHistoricRoot or DuplicateNullifier without a transfer or withdraw, then
  // make sure to remove this piece of code.
  else if (
    ((blockConfig[0] === 'IncorrectHistoricRoot' || blockConfig[0] === 'DuplicateNullifier') &&
      anyTransferWithdraw === 0) ||
    (blockConfig[0] === 'InvalidTransaction' && anyERC20ERC721 === 0)
  ) {
    [blockConfig[0], blockConfig[1]] = [blockConfig[1], blockConfig[0]];
  } else {
    logger.debug(`Creating invalid block of type ${blockConfig[0]}`);
    block = await InvalidBlock.invalidBuild({
      proposer,
      transactions,
      invalidBlockType: blockConfig[0],
    });
  }
  // remove the processed bad block type, which is the first one in the array.
  // can be run on empty block config array too without a problem
  blockConfig.splice(0, 1);
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
    if ((await numberOfUnprocessedTransactions()) >= TRANSACTIONS_PER_BLOCK) {
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
        await ws.send(
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
      await removeTransactionsFromMemPool(block);
    }
  }
  // Let's slow down here so we don't slam the database.
  await new Promise(resolve => setTimeout(resolve, 3000));
}
