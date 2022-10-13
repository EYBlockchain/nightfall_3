/**
 * @module chain-reorg.mjs
 * @desc This module contains functions for handling updates to the layer 2 state as
 * the result of a layer 1 chain reorganisation.
 */

/**
 * function to update the state of a commitment following the removal of a
 * BlockProposed event.
 */
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import {
  getCommitmentsByTransactionHashL1,
  getNullifiedByTransactionHashL1,
  updateCommitment,
} from '../services/commitment-storage.mjs';
import {
  getBlockByTransactionHashL1,
  deleteTreeByTransactionHashL1,
  clearBlockNumberL1ForBlock,
} from '../services/database.mjs';

async function removeBlockProposedEventHandler(eventObject) {
  logger.info('Received block proposed removal event');

  /*
   We'll deal with the commitments first:
   let's get the L1 transactionHash that created the block, we can use this
   to pull the commitments and nullifiers in the block from the L2 database
   */
  const { transactionHash } = eventObject;
  const commitmentsAddedInBlock = await getCommitmentsByTransactionHashL1(transactionHash);
  const commitmentsNullifiedInBlock = await getNullifiedByTransactionHashL1(transactionHash);

  /*
   now we have these commitments, we need to reset their properties according to the
   instructions in doc/chain-reorgs.md.
   */
  await Promise.all([
    ...commitmentsAddedInBlock.map(c => updateCommitment(c, { isOnChain: -1 })),
    ...commitmentsNullifiedInBlock.map(c => updateCommitment(c, { isNullifiedOnChain: -1 })),
  ]);

  /*
   Then the the blocks we have stored and the commitment tree:
   we need to remove the state associated with this event from the Timber class
   so find out which L2 block has been removed by this event removal.
   */
  logger.debug({
    msg: 'Looking for block with transactionHash',
    transactionHash,
  });

  const block = await getBlockByTransactionHashL1(transactionHash);

  /*
   now we can clear the L1 blocknumber to indicate that the L2 block is no longer
   on chain (if it's a block that we have saved)
   */
  if (block) await clearBlockNumberL1ForBlock(transactionHash);

  // then we delete the Timber record associated with this block
  logger.debug({
    msg: 'Deleting tree with proposeBlock transactionHash',
    transactionHash,
  });

  return deleteTreeByTransactionHashL1(transactionHash);
}

export default removeBlockProposedEventHandler;
