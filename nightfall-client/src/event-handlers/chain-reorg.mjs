/**
@module chain-reorg.mjs
@desc This module contains functions for handling updates to the layer 2 state as
the result of a layer 1 chain reorganisation.
*/

/**
function to update the state of a commitment following the removal of a
BlockProposed event.
*/
import logger from 'common-files/utils/logger.mjs';
import {
  getCommitmentsByTransactionHashL1,
  getNullifiedByTransactionHashL1,
  updateCommitment,
} from '../services/commitment-storage.mjs';
import {
  getBlockByTransactionHashL1,
  deleteTreeByBlockNumberL2,
  clearBlockNumberL1ForBlock,
} from '../services/database.mjs';

async function removeBlockProposedEventHandler(eventObject) {
  logger.info('Received block proposed removal event');
  // We'll deal with the commitments first:
  // let's get the L1 transactionHash that created the block, we can use this
  // to pull the commitments and nullifiers in the block from the L2 database
  const { transactionHash } = eventObject;
  const commitmentsAddedInBlock = await getCommitmentsByTransactionHashL1(transactionHash);
  const commitmentsNullifiedInBlock = await getNullifiedByTransactionHashL1(transactionHash);
  // logger.debug(
  //  `Found these commitments in the db ${JSON.stringify(commitmentsAddedInBlock, null, 2)}`,
  // );
  // now we have these commitments, we need to reset their properties according to the
  // instructions in doc/chain-reorgs.md.
  await Promise.all([
    ...commitmentsAddedInBlock.map(c => updateCommitment(c, { isOnChain: -1 })),
    ...commitmentsNullifiedInBlock.map(c => updateCommitment(c, { isNullifiedOnChain: -1 })),
  ]);
  // Then the the blocks we have stored and the commitment tree:
  // we need to remove the state associated with this event from the Timber class
  // so find out which L2 block has been removed by this event removal.
  logger.debug(`Looking for block with transactionHash, ${transactionHash}`);
  const block = await getBlockByTransactionHashL1(transactionHash);
  if (block) logger.debug(`Found L2 block ${block.blockNumberL2}`);
  else throw new Error(`Could not find L2 block with L1 transactionHash, ${transactionHash}`);
  // then we delete the Timber record associated with this block
  const res = await deleteTreeByBlockNumberL2(block.blockNumberL2);
  logger.debug(`Deleted tree with block number ${block.blockNumberL2}, ${res}`);
  // now we can clear the L1 blocknumber to indicate that the L2 block is no longer
  // on chain.
  return clearBlockNumberL1ForBlock(eventObject.transactionHash);
}

export default removeBlockProposedEventHandler;
