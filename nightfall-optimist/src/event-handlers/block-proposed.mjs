import logger from '../utils/logger.mjs';
import checkBlock from '../services/check-block.mjs';
import BlockError from '../classes/block-error.mjs';
import { createChallenge } from '../services/challenges.mjs';
import {
  removeTransactionsFromMemPool,
  saveBlock,
  stampNullifiers,
} from '../services/database.mjs';
import { getProposeBlockCalldata } from '../services/process-calldata.mjs';

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data) {
  const currentBlockCount = data.blockNumber;
  const { block, transactions } = await getProposeBlockCalldata(data);
  logger.info('Received BlockProposed event');
  console.log('HERE transactions in optimist', transactions);

  try {
    // and save the block to facilitate later lookup of block data
    // we will save before checking because the database at any time should reflect the state the blockchain holds
    // when a challenge is raised because the is correct block data, then the corresponding block deleted event will
    // update this collection
    await saveBlock({ blockNumber: currentBlockCount, ...block });
    // Update the nullifiers we have stored, with the blockhash. These will
    // be deleted if the block check fails and we get a rollback.  We do this
    // before running the block check because we want to delete the nullifiers
    // asociated with a failed block, and we can't do that if we haven't
    // associated them with a blockHash.
    await stampNullifiers(
      transactions
        .map(tx =>
          tx.nullifiers.filter(
            nulls => nulls !== '0x0000000000000000000000000000000000000000000000000000000000000000',
          ),
        )
        .flat(Infinity),
      block.blockHash,
    );
    // we'll check the block and issue a challenge if appropriate
    await checkBlock(block, transactions);
    // if the block is, in fact, valid then we also need to mark as used the
    // transactions in the block from our database of unprocessed transactions,
    // so we don't try to use them in a block which we're proposing.
    await removeTransactionsFromMemPool(block); // TODO is await needed?
    // signal to the block-making routines that a block is received: they
    // won't make a new block until their previous one is stored on-chain.
    logger.info('Block Checker - Block was valid');
  } catch (err) {
    if (err instanceof BlockError) {
      logger.warn(`Block Checker - Block invalid, with code ${err.code}! ${err.message}`);
      await createChallenge(block, transactions, err);
    } else throw new Error(err);
  }
}

export default blockProposedEventHandler;
