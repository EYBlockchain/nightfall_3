/**
Module to check that submitted Blocks and Transactions are valid
*/
import logger from 'common-files/utils/logger.mjs';
import { BlockError } from '../classes/index.mjs';
import checkTransaction from './transaction-checker.mjs';
import {
  numberOfBlockWithTransactionHash,
  retrieveMinedNullifiers,
  getBlockByBlockNumberL2,
  getTreeByLeafCount,
} from './database.mjs';

/**
Checks the block's properties.  It will return the first inconsistency it finds
@param {object} block - the block being checked
@param {array} transactions - array of transaction objects whose transaction hashes are contained in the block (in hash order).
TODO - nullifiers
*/

async function checkBlock(block, transactions) {
  // Check that the leafCount is correct
  // we do this first because subsequent checks are reliant on the leafCount
  // being correct!
  // We need to get hold of the prior block to do this because the leafCount
  // is derrived from data in that block.
  if (block.blockNumberL2 > 0) {
    const priorBlock = await getBlockByBlockNumberL2(block.blockNumberL2 - 1);
    if (priorBlock === null) logger.warn('Could not find prior block while checking leaf count');
    if (priorBlock.leafCount + priorBlock.nCommitments !== block.leafCount)
      throw new BlockError('The leaf count in the block is not correct', 7);
  } else if (block.leafCount !== 0)
    // this throws if it's the first block and leafCount!=0, which is impossible
    throw new BlockError('The leaf count in the block is not correct', 7);

  // now we have to check the commitment root.  For this we can make use of
  // Timber with its optimistic extensions.
  logger.debug(`Checking block with leafCount ${block.leafCount}`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  // There's a bit of an issue here though.  It's possible that our block didn't
  // add any new leaves to Timber if it's a block with just withdrawals in.
  // In this case, Timber won't update its DB and consequently won't write a
  // new history. To check the block in this case, we make sure the root isn't
  // changed from the previous block.
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
      0,
    );

  // check if the transactions in the block have not already been submitted
  // This will also capture a duplicate block error
  await Promise.all(
    transactions.map(async (transaction, index) => {
      if ((await numberOfBlockWithTransactionHash(transaction.transactionHash)) > 1)
        throw new BlockError(
          `The transaction with transaction hash (${transaction.transactionHash}) has already been submitted, hence this block is incorrect`,
          1,
          { transactionHashIndex: index, transactionHash: transaction.transactionHash },
        );
    }),
  );

  // Check nullifiers for duplicates that have already been mined. It's possible to get a block that
  // we haven't seen the transactions for, because it was made from off-chain transactions. Thus, it's not
  // sufficient just to check transactions for duplicate nullifiers. Also, we have to be careful not
  // to check a block against itself (hence the second filter).
  const storedMinedNullifiers = await retrieveMinedNullifiers(); // List of Nullifiers stored by blockProposer
  const blockNullifiers = transactions.map(tNull => tNull.nullifiers).flat(Infinity); // List of Nullifiers in block
  const alreadyMinedNullifiers = storedMinedNullifiers
    .filter(sNull => blockNullifiers.includes(sNull.hash))
    .filter(aNull => aNull.blockHash !== block.blockHash);
  if (alreadyMinedNullifiers.length > 0) {
    throw new BlockError(
      `Some Nullifiers included in ${block.blockHash} have been included in previous blocks.`,
      6,
    );
  }

  // check if the transactions are valid - transaction type, public input hash and proof verification are all checked
  for (let i = 0; i < transactions.length; i++) {
    try {
      await checkTransaction(transactions[i]); // eslint-disable-line no-await-in-loop
    } catch (err) {
      if (err.code !== 2) {
        // Error 2 of transaction checker does not need a challenge
        throw new BlockError(
          `The transaction check failed with error: ${err.message}`,
          err.code === 1 ? 2 : err.code, // mapping transaction error to block error
          {
            transaction: transactions[i],
            transactionHashIndex: block.transactionHashes.indexOf(transactions[i].transactionHash),
          },
        );
      }
    }
  }
}

export default checkBlock;
