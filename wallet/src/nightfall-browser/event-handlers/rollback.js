// ignore unused exports default

/**
Each time the Shield contract removes a block from the blockHash linked-list,
as a result of a rollback, this event gets fired.  We can use it to remove the
same blocks from our local database record and to reset cached Frontier and
leafCount values in the Block class
*/
import logger from '../../common-files/utils/logger';
import {
  clearNullified,
  clearOnChain,
  deleteCommitments,
  getCommitmentsFromBlockNumberL2,
} from '../services/commitment-storage';
import {
  deleteTreeByBlockNumberL2,
  deleteBlocksByBlockNumberL2,
  findBlocksFromBlockNumberL2,
  deleteTransactionsByTransactionHashes,
} from '../services/database';

async function rollbackEventHandler(data) {
  const blockNumberL2 = data;
  logger.info(`Received Rollback event, with layer 2 block number ${blockNumberL2}`);

  // We get the commitments from blockNumberL2 + 1 because the bad block itself (except
  // the reason it is bad) contains valid transactions, we should not drop these.
  // If we clear the commitments in blockNumberL2, we may spend them again while they are in an optimist mempool.
  const commitments = await getCommitmentsFromBlockNumberL2(Number(blockNumberL2) + 1);
  // Deposit transactions should not be dropped because they are always valid even post-rollback.
  const nonDeposit = commitments.filter(c => c.isDeposited === false).map(c => c._id);
  logger.debug(`nonDeposit: ${JSON.stringify(nonDeposit)}`);
  // Any commitments that have been nullified and are now no longer spent because
  // of the rollback should be made available to be spent again.
  const nullified = await clearNullified(Number(blockNumberL2));
  if (nullified) {
    const { result } = nullified;
    logger.debug(`Rollback removed ${result.nModified} nullfiers`);
  }

  const clear = await clearOnChain(Number(blockNumberL2));
  if (clear) {
    const cResult = clear;
    logger.debug(`Rollback moved ${cResult.result.nModified} commitments off-chain`);
  }

  const blocksToDelete = await findBlocksFromBlockNumberL2(Number(blockNumberL2));
  const txsToDelete = blocksToDelete.map(b => b.transactionHashes).flat(Infinity);

  await Promise.all([
    deleteTreeByBlockNumberL2(Number(blockNumberL2)),
    deleteCommitments(nonDeposit),
    deleteBlocksByBlockNumberL2(Number(blockNumberL2)),
    deleteTransactionsByTransactionHashes(txsToDelete),
  ]);
}

export default rollbackEventHandler;
