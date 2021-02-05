/**
Module to check that submitted Blocks and Transactions are valid
*/
import Block from '../classes/block.mjs';
import Transaction from '../classes/transaction.mjs';
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
  // first, check the hash is correct.  That's nice and easy
  if (!Block.checkHash(block))
    throw new BlockError(`Block hash ${block.blockHash} is not in the Timber database`, 0);
  // next easiest is checking that block's transactions have correct hashes
  // and they're the ones in the block
  for (let i = 0; i < transactions.length; i++) {
    if (!Transaction.checkHash(transactions[i]))
      throw new BlockError(
        ` The transaction hash ${transactions[i].transactionHash} is not consistent with the transaction data at index ${i}`,
        1,
        { index: i },
      );
    if (!block.transactionHashes.includes(transactions[i].transactionHash))
      throw new BlockError(
        `Transaction hash ${transactions[i].transactionHash} missing from block at index ${i}`,
        2,
        { index: i },
      );
  }
  // we may even be short a hash or two...
  if (transactions.length !== block.transactionHashes.length)
    throw new BlockError(
      `The number of transactions (${transactions.length}) provided is not consistent with the number of transaction hashes in the block (${block.transactionHashes.length})`,
      3,
    );
  // now we have to check the commitment root.  For this we can make use of
  // Timber with its optimistic extensions.
  // Start by seeing if Timber knows about the root.  It should.
  try {
    logger.debug(`Checking block with root ${block.root}`);
    const history = await getTreeHistory(block.root);
    logger.debug(`Retrieved history from Timber ${JSON.stringify(history, null, 2)}`);
    // Timber does know the root, but is it correct?  The historic frontier,
    // together with the commitments should produce the correct root.
    const commitmentHashes = transactions
      .map(transaction => transaction.commitments)
      .flat(Infinity);
    const { root } = await mt.updateNodes(commitmentHashes, history.leafIndex, history.frontier);
    if (root !== block.root)
      throw new BlockError(
        `The block's root (${block.root}) is known to Timber but it cannot be reconstructed from the commitment hashes in the transactions in this block and the historic Frontier held by Timber for this root`,
        4,
      );
  } catch (err) {
    logger.error(err); // log errors but let the caller handle them
    throw new BlockError(`The block root (${block.root}) was not found in the Timber database`, 5);
  }
  return null; // if we've got here with no BlockErrors being thrown then our checks have passed.
}

export default checkBlock;
