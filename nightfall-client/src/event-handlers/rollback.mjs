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
  getAllCommitments,
  deleteCommitments,
} from '../services/commitment-storage.mjs';
import { getLeafCount } from '../utils/timber.mjs';

async function rollbackEventHandler(data) {
  const { blockNumberL2, leafCount } = data.returnValues;
  logger.info(`Received Rollback event, with layer 2 block number ${blockNumberL2}`);

  // Firstly we should check that timber has also complete a rollback
  let timberLeafCount;
  do {
    // eslint-disable-next-line no-await-in-loop
    timberLeafCount = await getLeafCount();
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 3000));
  } while (Number(timberLeafCount) !== Number(leafCount));

  // Any commitments that have been nullified and are now no longer spent because
  // of the rollback should be made available to be spent again.
  const { result } = await clearNullified(blockNumberL2);
  logger.debug(`Rollback removed ${result.nModified} nullfiers`);
  const cResult = await clearOnChain(blockNumberL2);
  logger.debug(`Rollback moved ${cResult.result.nModified} commitments off-chain`);

  // There's a better way to do this, but this will suffice until testing is done
  const allCommits = await getAllCommitments();
  const commitsToCheck = allCommits;

  logger.info(`Commits to check: ${commitsToCheck.map(c => c._id)}`);
  const commitsToDelete = [];
  commitsToCheck.forEach(async c => {
    try {
      await c.index;
    } catch (error) {
      commitsToDelete.push(c._id);
    }
  });

  logger.info(`Deleting commitments: ${commitsToDelete}`);
  await deleteCommitments(commitsToDelete);
}

export default rollbackEventHandler;
