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
import { getCommitmentsByTransactionHashL1 } from '../services/commitment-storage.mjs';

export async function removeBlockProposedEventHandler(eventObject) {
  logger.info('Received block proposed removal event');
  // let's get the L1 transactionHash that created the block, we can use this
  // to pull the commitment from the L2 database
  const { transactionHash } = eventObject;
  const commitments = await getCommitmentsByTransactionHashL1(transactionHash);
  logger.debug(`Found these commitments in the db ${JSON.stringify}`)
}

export async function removeTransactionSubmittedEventHandler(eventObject) {
  console.log('TRANSACTIONSUBMITTEDREMOVED', eventObject);
}
