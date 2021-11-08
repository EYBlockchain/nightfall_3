/**
@module chain-reorg.mjs
@desc This module contains functions for handling updates to the layer 2 state as
the result of a layer 1 chain reorganisation.
*/

/**
function to update the state of a commitment following the removal of a
BlockProposed event.
*/
import { Mutex } from 'async-mutex';
import logger from 'common-files/utils/logger.mjs';
import {
  getCommitmentsByTransactionHashL1,
  getOutputCommitmentsByTransactionHashL1,
  deleteCommitments,
  updateCommitment,
} from '../services/commitment-storage.mjs';

const mutex = new Mutex();

// function to get all generations of output commitments
async function recurseOutputCommitments(transactionHash, outputCommitments) {
  const ocs = await getOutputCommitmentsByTransactionHashL1(transactionHash);
  if (ocs.length === 0) return outputCommitments;
  await mutex.runExclusive(() => outputCommitments.push(...ocs));
  return Promise.all(
    ocs.map(oc => recurseOutputCommitments(oc.transactionHashCommittedL1, outputCommitments)),
  );
}

export async function removeBlockProposedEventHandler(eventObject) {
  logger.info('Received block proposed removal event');
  // let's get the L1 transactionHash that created the block, we can use this
  // to pull the commitment from the L2 database
  const { transactionHash } = eventObject;
  const commitments = await getCommitmentsByTransactionHashL1(transactionHash);
  logger.debug(`Found these commitments in the db ${JSON.stringify(commitments, null, 2)}`);
  // now we have these commitments, we need to reset their properties according to the
  // instructions in doc/chain-reorgs.md.
  const processedCommitments = commitments.map(ct => {
    const c = ct;
    c.isOnChain = -1;
    c.isNullified = false;
    c.isNullifiedOnChain = false;
    c.isPendingNullification = false;
    return c;
  });
  // should we await this?
  processedCommitments.forEach((c, i) => updateCommitment(commitments[i], processedCommitments[i]));
  console.log('Processed Commitments are', processedCommitments);
  // we have one more job, and that's to delete the output commitments (if any)
  // that were created from these commitments. There may more than one generation
  // of output commitments. We get them all.
  // const outputCommitments = await recurseOutputCommitments(transactionHash, []);
  // await deleteCommitments(outputCommitments.map(c => c._id));
  // console.log('Found output commitments', outputCommitments);
}

export async function removeTransactionSubmittedEventHandler(eventObject) {
  console.log('TRANSACTIONSUBMITTEDREMOVED', eventObject);
}
