/**
Module to check that submitted Blocks and Transactions are valid
*/
// import Block from '../classes/block.mjs';
// import Transaction from '../classes/transaction.mjs';
import { getTreeHistory } from '../utils/timber.mjs';
import logger from '../utils/logger.mjs';
import mt from '../utils/crypto/merkle-tree/merkle-tree.mjs';
import BlockError from '../classes/block-error.mjs';

/**
Checks the block's properties.  It will return the first inconsistency it finds
@param {object} block - the block being checked
@param {array} transactions - array of transaction objects whose transaction hashes are contained in the block (in hash order).
TODO - nullifiers
*/
async function checkBlock(block, transactions) {
  // now we have to check the commitment root.  For this we can make use of
  // Timber with its optimistic extensions.
  // Start by seeing if Timber knows about the root.  It should.
  let history;
  try {
    logger.debug(`Checking block with root ${block.root}`);
    history = await getTreeHistory(block.root);
    logger.debug(`Retrieved history from Timber`);
    logger.silly(`Timber history was ${JSON.stringify(history, null, 2)}`);
  } catch (err) {
    logger.error(err); // log errors but let the caller handle them
    throw new BlockError(`The block root (${block.root}) was not found in the Timber database`, 0);
  }

  // Timber does know the root, but is it correct?  The historic frontier,
  // together with the commitments should produce the correct root.
  const commitmentHashes = transactions.map(transaction => transaction.commitments).flat(Infinity);
  const { root } = await mt.updateNodes(
    commitmentHashes,
    history.currentLeafCount,
    history.frontier,
  );
  if (root !== block.root)
    throw new BlockError(
      `The block's root (${block.root}) is known to Timber but it cannot be reconstructed from the commitment hashes in the transactions in this block and the historic Frontier held by Timber for this root`,
      1,
    );
}

export default checkBlock;
