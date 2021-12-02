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

async function removeBlockProposedEventHandler(eventObject) {
  logger.info('Received block proposed removal event');
  // let's get the L1 transactionHash that created the block, we can use this
  // to pull the commitments and nullifiers in the block from the L2 database
  const { transactionHash } = eventObject;
  const commitmentsAddedInBlock = await getCommitmentsByTransactionHashL1(transactionHash);
  const commitmentsNullifiedInBlock = await getNullifiedByTransactionHashL1(transactionHash);
  logger.debug(
    `Found these commitments in the db ${JSON.stringify(commitmentsAddedInBlock, null, 2)}`,
  );
  // now we have these commitments, we need to reset their properties according to the
  // instructions in doc/chain-reorgs.md.
  return Promise.all([
    ...commitmentsAddedInBlock.map(c => updateCommitment(c, { isOnChain: -1 })),
    ...commitmentsNullifiedInBlock.map(c => updateCommitment(c, { isNullifiedOnChain: -1 })),
  ]);
}

export default removeBlockProposedEventHandler;
