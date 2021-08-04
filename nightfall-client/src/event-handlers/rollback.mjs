/**
Each time the Shield contract removes a block from the blockHash linked-list,
as a result of a rollback, this event gets fired.  We can use it to remove the
same blocks from our local database record and to reset cached Frontier and
leafCount values in the Block class
*/
import logger from 'common-files/utils/logger.mjs';
import {
  clearNullified,
  clearOnChain,
  dropRollbackCommitments,
} from '../services/commitment-storage.mjs';

async function rollbackEventHandler(data) {
  const { blockNumberL2 } = data.returnValues;
  logger.info(`Received Rollback event, with layer 2 block number ${blockNumberL2}`);
  // Any commitments that have been nullified and are now no longer spent because
  // of the rollback should be made available to be spent again.
  const { result } = await clearNullified(blockNumberL2);
  logger.debug(`Rollback removed ${result.nModified} nullfiers`);
  const cResult = await clearOnChain(blockNumberL2);
  logger.debug(`Rollback moved ${cResult.result.nModified} commitments off-chain`);
  const dResult = await dropRollbackCommitments(blockNumberL2);
  logger.debug(`Rollback removed ${dResult.deletedCount} output commitments`);
}

export default rollbackEventHandler;
