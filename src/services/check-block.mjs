/**
Module to check that submitted Blocks and Transactions are valid
*/
import Block from '../classes/block.mjs';
import Transaction from '../classes/transaction.mjs';
import { getTreeHistory } from '../utils/timber.mjs';
import logger from '../utils/logger.mjs';
import utils from '../utils/crypto/merkle-tree/utils.mjs';

const { concatenateThenHash } = utils;
/**
Checks that a siblingPath is valid, by successive hashing
*/
function checkPath(history) {
  const { root, frontier, leafIndex } = history;
  let index = leafIndex;
  let hash = frontier[0];
  const orderedHash = (a, b) => {
    let result;
    if (index % 2 === 0) result = concatenateThenHash(a, b);
    else result = concatenateThenHash(b, a);
    index = Math.floor(index / 2);
    return result;
  };
  // the frontier numbers by tree level, so frontier[0] is the leaf, frontier[32] is the root
  for (let i = 0; i < frontier.length; i++) {
    hash = orderedHash(hash, frontier[i]);
  }
  if (hash !== root)
    logger.warn(`Merkle path check failed. Expected root ${root}, calculated root ${hash}`);
  return hash === root;
}

/**
Checks the block's properties.  It will return the first inconsistency it finds
*/
async function checkBlock(block, transactions) {
  // first, check the hash is correct.  That's nice and easy
  if (!Block.checkHash(block)) return { type: 'BLOCK_HASH_INVALID', value: block.blockHash };
  // next easiest is checking that block's transactions have correct hashes
  // and they're the ones in the block
  for (let i = 0; i < transactions.length; i++) {
    if (!Transaction.checkHash(transactions[i]))
      return { type: 'TRANSACTION_HASH_INVALD', value: transactions[i].transactionHash, index: i };
    if (!block.transactionHashes.includes(transactions[i].transactionHash))
      return {
        type: 'TRANSACTION_HASH_NOT_INCLUDED',
        value: transactions[i].transactionHash,
        index: i,
      };
  }
  // we may even be short a hash or two...
  if (transactions.length !== block.transactionHashes.length)
    return { type: 'TRANSACTION_HASH_MISSING' };
  // now we have to check the root.  For this we can make use of Timber with its
  // optimistic extensions
  // start by seeing if Timber knows about the root.  It should.
  try {
    logger.debug(`Checking block with root ${block.root}`);
    const history = await getTreeHistory(block.root);
    logger.debug(`Retrieved history from Timber ${JSON.stringify(history, null, 2)}`);
    // Timber does know the root, but is it correct?  The historic frontier should
    // also be the siblingPath for the last commitment made under this root.
    if (!checkPath(history)) return { type: 'ROOT_INCORRECT', value: block.root };
  } catch (err) {
    logger.error(err); // log errors but let the caller handle them
    return { type: 'ROOT_NOT_FOUND', value: block.root };
  }
  return { type: 'NO_ISSUES_FOUND' };
}

export default checkBlock;
