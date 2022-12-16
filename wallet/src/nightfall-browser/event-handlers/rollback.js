/* eslint-disable no-continue */
// ignore unused exports default

/**
Each time the Shield contract removes a block from the blockHash linked-list,
as a result of a rollback, this event gets fired.  We can use it to remove the
same blocks from our local database record and to reset cached Frontier and
leafCount values in the Block class
*/
import logger from '../../common-files/utils/logger';
import {
  clearNullifiedOnChain,
  clearNullifiers,
  clearOnChain,
  deleteCommitments,
} from '../services/commitment-storage';
import {
  deleteTreeByBlockNumberL2,
  deleteBlocksByBlockNumberL2,
  findBlocksFromBlockNumberL2,
  deleteTransactionsByTransactionHashes,
  getTransactionsByTransactionHashesByL2Block,
} from '../services/database';

const { ZERO } = global.nightfallConstants;

function checkValidHistoricRootsBlockNumber(transaction, latestBlockNumberL2) {
  for (let i = 0; i < transaction.historicRootBlockNumberL2.length; ++i) {
    if (
      transaction.nullifiers[i] !== ZERO &&
      Number(transaction.historicRootBlockNumberL2[i]) > latestBlockNumberL2
    ) {
      return false;
    }
  }

  return true;
}

async function rollbackEventHandler(data) {
  const { blockNumberL2 } = data.returnValues;

  logger.info({
    msg: 'Received Rollback event, with layer 2 block number',
    blockNumberL2,
  });

  const blocksToBeDeleted = await findBlocksFromBlockNumberL2(Number(blockNumberL2));

  logger.info({ msg: 'Rollback - rollback layer 2 blocks', blocksToBeDeleted });

  const validTransactions = [];
  const validCommitments = [];

  const invalidTransactions = [];
  const invalidNullifiers = [];
  const invalidCommitments = [];

  // We will assume that all transactions that the client contains are valid. However,
  // all transactions that are using a commitment that were nullified in a block that
  // that was rollbacked will need to be deleted from the database
  for (let i = 0; i < blocksToBeDeleted.length; i++) {
    // Get the trannsaction hashes included in these blocks
    const transactionHashesInBlock = blocksToBeDeleted[i].transactionHashes.flat(Infinity);
    // Use the transaction hashes to grab the actual transactions filtering out deposits - In Order.
    // eslint-disable-next-line no-await-in-loop
    const blockTransactions = await getTransactionsByTransactionHashesByL2Block(
      transactionHashesInBlock,
      blocksToBeDeleted[i],
    );
    logger.info({
      msg: 'Rollback - blockTransactions to check:',
      blockTransactions: transactionHashesInBlock,
      clientTransactions: blockTransactions.map(t => t.transactionHash),
    });

    for (let j = 0; j < blockTransactions.length; ++j) {
      const transaction = blockTransactions[j];

      const commitments = transaction.commitments.filter(c => c !== ZERO);
      const nullifiers = transaction.nullifiers.filter(n => n !== ZERO);

      if (transaction.isDecrypted) {
        invalidTransactions.push(transaction.transactionHash);
        invalidCommitments.push(commitments[0]);
        continue;
      }

      if (!checkValidHistoricRootsBlockNumber(transaction, blockNumberL2 - 1)) {
        invalidTransactions.push(transaction.transactionHash);
        invalidCommitments.push(...commitments);
        invalidNullifiers.push(...nullifiers);
        continue;
      }

      validTransactions.push(transaction.transactionHash);
      validCommitments.push(...commitments);
    }
  }

  logger.debug({
    msg: 'Rollback - Updating Client DB',
    validTransactions,
    invalidTransactions,
  });

  logger.debug({
    msg: 'Updating commitments && nullifiers',
    validCommitments,
    invalidCommitments,
    invalidNullifiers,
  });

  await Promise.all([
    deleteTreeByBlockNumberL2(Number(blockNumberL2)),
    deleteBlocksByBlockNumberL2(Number(blockNumberL2)),
    clearNullifiedOnChain(Number(blockNumberL2)),
    clearNullifiers(invalidNullifiers),
    clearOnChain(validCommitments),
    deleteCommitments(invalidCommitments),
    deleteTransactionsByTransactionHashes(invalidTransactions),
  ]);
}

export default rollbackEventHandler;
