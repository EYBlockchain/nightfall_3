/**
Module to check that submitted Blocks and Transactions are valid
*/
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { BlockError } from '../classes/index.mjs';
import { checkTransaction } from './transaction-checker.mjs';
import { getBlockByBlockNumberL2, getTreeByLeafCount } from './database.mjs';

const { ZERO } = config;

// Check that the leafCount is correct
// we do this first because subsequent checks are reliant on the leafCount
// being correct!
// We need to get hold of the prior block to do this because the leafCount
// is derrived from data in that block.
async function checkLeafCount(block) {
  logger.debug(`Checking block with leafCount ${block.leafCount}`);
  if (block.blockNumberL2 > 0) {
    const priorBlock = await getBlockByBlockNumberL2(block.blockNumberL2 - 1);
    if (priorBlock === null) logger.warn('Could not find prior block while checking leaf count');
    if (priorBlock.leafCount + priorBlock.nCommitments !== block.leafCount)
      throw new BlockError('The leaf count in the block is not correct', 0);
  } else if (block.leafCount !== 0)
    // this throws if it's the first block and leafCount!=0, which is impossible
    throw new BlockError('The leaf count in the block is not correct', 0);
}

// There's a bit of an issue here though.  It's possible that our block didn't
// add any new leaves to Timber if it's a block with just withdrawals in.
// In this case, Timber won't update its DB and consequently won't write a
// new history. To check the block in this case, we make sure the root isn't
// changed from the previous block.
async function checkBlockRoot(block) {
  let history; // this could end up being a Block or Timber history object - as they both have root properties, that's fine.
  if (block.nCommitments === 0) {
    history = await getBlockByBlockNumberL2(block.blockNumberL2 - 1);
    logger.debug('Block has no commitments - checking its root is the same as the previous block');
  } else {
    while (!history) {
      // eslint-disable-next-line no-await-in-loop
      history = await getTreeByLeafCount(block.leafCount + block.nCommitments);
      logger.debug(`Block has commitments - retrieved history from Timber`);
      logger.trace(`Timber history was ${JSON.stringify(history, null, 2)}`);

      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  if (history.root !== block.root)
    throw new BlockError(
      `The block's root (${block.root}) cannot be reconstructed from the commitment hashes in the transactions in this block and the historic Frontier held by Timber for this root`,
      1,
    );
}

// check if there are duplicate commitments in different transactions of the same block
export function checkDuplicateCommitmentsWithinBlock(block, transactions) {
  const blockCommitments = transactions.map(transaction => transaction.commitments).flat(Infinity);
  blockCommitments.forEach((blockCommitment, index) => {
    const lastIndex = blockCommitments.lastIndexOf(blockCommitment);
    if (
      blockCommitment !== ZERO &&
      // blockCommitments.indexOf(blockCommitment) !== blockCommitments.lastIndexOf(blockCommitment)
      index !== lastIndex
    ) {
      throw new BlockError(
        `The block check failed due to duplicate commitments in different transactions of the same block`,
        2,
        {
          block1: block,
          transactions1: transactions,
          transaction1Index: index % 2 === 0 ? index / 2 : (index - 1) / 2,
          duplicateCommitment1Index: index % 2 === 0 ? 0 : 1,
          block2: block,
          transactions2: transactions,
          transaction2Index: lastIndex % 2 === 0 ? lastIndex / 2 : (lastIndex - 1) / 2,
          duplicateCommitment2Index: lastIndex % 2 === 0 ? 0 : 1,
        },
      );
    }
  });
}

// check if there are duplicate nullifiers in different transactions of the same block
export function checkDuplicateNullifiersWithinBlock(block, transactions) {
  const blockNullifiers = transactions.map(transaction => transaction.nullifiers).flat(Infinity);
  blockNullifiers.forEach((blockNullifier, index) => {
    const lastIndex = blockNullifiers.lastIndexOf(blockNullifier);
    if (
      blockNullifier !== ZERO &&
      // blockNullifiers.indexOf(blockNullifier) !== blockNullifiers.lastIndexOf(blockNullifier)
      index !== lastIndex
    ) {
      throw new BlockError(
        `The block check failed due to duplicate nullifiers in different transactions of the same block`,
        3,
        {
          block1: block,
          transactions1: transactions,
          transaction1Index: index % 2 === 0 ? index / 2 : (index - 1) / 2,
          duplicateNullifier1Index: index % 2 === 0 ? 0 : 1,
          block2: block,
          transactions2: transactions,
          transaction2Index: lastIndex % 2 === 0 ? lastIndex / 2 : (lastIndex - 1) / 2,
          duplicateNullifier2Index: lastIndex % 2 === 0 ? 0 : 1,
        },
      );
    }
  });
}

/**
Checks the block's properties.  It will return the first inconsistency it finds
@param {object} block - the block being checked
@param {array} transactions - array of transaction objects whose transaction hashes are contained in the block (in hash order).
TODO - nullifiers
*/

export async function checkBlock(block, transactions) {
  await checkLeafCount(block);
  // now we have to check the commitment root.
  // For this we can make use of Timber with its optimistic extensions.
  await new Promise(resolve => setTimeout(resolve, 1000));
  await checkBlockRoot(block);
  await checkDuplicateCommitmentsWithinBlock(block, transactions);
  await checkDuplicateNullifiersWithinBlock(block, transactions);
  // check if the transactions are valid - transaction type, public input hash and proof verification are all checked
  for (let i = 0; i < transactions.length; i++) {
    try {
      await checkTransaction(transactions[i], false, { blockNumberL2: block.blockNumberL2 }); // eslint-disable-line no-await-in-loop
    } catch (err) {
      if (err.code + 2 === 2 || err.code + 2 === 3)
        err.metadata = {
          ...err.metadata,
          block1: block,
          transactions1: transactions,
          transaction1Index: block.transactionHashes.indexOf(transactions[i].transactionHash),
        };
      throw new BlockError(
        `The transaction check failed with error: ${err.message}`,
        err.code + 2, // mapping transaction error to block error
        {
          ...err.metadata,
          transaction: transactions[i],
          transactionHashIndex: block.transactionHashes.indexOf(transactions[i].transactionHash),
        },
      );
    }
  }
}
