/**
Each time the Shield contract removes a block from the blockHash linked-list,
as a result of a rollback, this event gets fired.  We can use it to remove the
same blocks from our local database record and to reset cached Frontier and
leafCount values in the Block class
*/
import logger from 'common-files/utils/logger.mjs';
import { dequeueEvent, enqueueEvent } from 'common-files/utils/event-queue.mjs';
import constants from 'common-files/constants/index.mjs';
import {
  addTransactionsToMemPool,
  deleteBlock,
  findBlocksFromBlockNumberL2,
  resetNullifiers,
  deleteNullifiers,
  getTransactionsByTransactionHashes,
  getMempoolTransactions,
  deleteTransactionsByTransactionHashes,
  retrieveNullifiers,
  deleteTreeByBlockNumberL2,
} from '../services/database.mjs';
import Block from '../classes/block.mjs';
import checkTransaction from '../services/transaction-checker.mjs';

const { ZERO } = constants;

async function rollbackEventHandler(data) {
  const { blockNumberL2 } = data.returnValues;
  logger.info(`Received Rollback event, with layer 2 block number ${blockNumberL2}`);
  // reset the Block class cached values.
  Block.rollback();
  await deleteTreeByBlockNumberL2(Number(blockNumberL2));

  /*
  A Rollback occurs when an on-chain fraud proof (challenge) is accepted.
  During a rollback we have to do three things:
  1) Remove the block data from our database from the blockNumberL2 provided in the Rollback Event
  2) Return transactions to the mempool and delete those that may have become invalid as a result of the Rollback.
    i) Deposits: Are always valid so can safely be returned to the mempool:true without being deleted.
    ii) Transfers: Becomes invalid if its getBlockByBlockNumberL2 field references an incorrect or non-existent block root.
    iii) Withdrawal: The same condition as transfers.
  3) Delete nullifiers that correspond to invalid transfers, reset nullifiers for transfers returned to the mempool

  */

  // Get all blocks that need to be deleted
  const blocksToBeDeleted = await findBlocksFromBlockNumberL2(blockNumberL2);
  // Get the trannsaction hashes included in these blocks
  const transactionHashesInBlock = blocksToBeDeleted
    .map(block => block.transactionHashes)
    .flat(Infinity);

  // Use the transaction hashes to grab the actual transactions filtering out deposits - In Order.
  const blockTransactions = (
    await getTransactionsByTransactionHashes(transactionHashesInBlock)
  ).filter(t => t.transactionType !== '0');

  logger.info(`blockTransctions: ${JSON.stringify(blockTransactions)}`);
  // Now we have to also inspect any transfers that are in the mempool:true
  const mempool = (await getMempoolTransactions()).filter(
    m =>
      // Filter out deposits
      m.transactionType !== '0' &&
      // Filter only transaction with mempool: true
      m.mempool &&
      // Filter out any transactions already in block transactions - this may be true if we are not the proposer of a bad block
      // being rolled back. Blocks are only marked mempool: false once they pass block checks
      !blockTransactions.map(bt => bt.transactionHash).includes(m.transactionHash),
  );

  // Join both sets of transactions, the blockTransactions are in-order, while the mempool randomly ordered (which is fine)
  const transactions = blockTransactions.concat(mempool);

  // We can now reset or delete the local database.
  await Promise.all(
    blocksToBeDeleted
      .map(async block => [
        addTransactionsToMemPool(block),
        resetNullifiers(block.blockHash),
        deleteBlock(block.blockHash),
      ])
      .flat(1),
  );

  // Get nullifiers after we have reset, filtering out nullifiers that havent appeared on-chain
  const unspentNullifierHashes = (await retrieveNullifiers())
    .filter(s => s.blockHash === null)
    .map(sNull => sNull.hash);

  // We also get the spent nullifiers, to identiy duplicateNullifier errors that we can delete.
  const spentNullifierHashes = (await retrieveNullifiers())
    .filter(s => s.blockHash !== null)
    .map(sNull => sNull.hash);

  // Create sets to manage nullifiers and invalid transactions - this makes membership easier.
  const nullifierSet = new Set();
  // Spent nullifiers are used to check duplicate nullifiers
  const spentNullifierHashesSet = new Set(spentNullifierHashes);
  const invalidTransactionSet = new Set();
  // transactions that have passed the nullifier check
  const maybeValidTransactions = [];

  // The first test is to see if there are any duplicate nullifiers.
  // This test is done in order so the later of two transactions are deleted.
  // Note that while the mempool-half of transactions is unordered, that is ok with us
  // We preference valid transactions that were in blocks, rather than mempool transactions.
  // If two mempool transactions have duplicate nullifiers, the choice of which to delete will differ
  // between optimist instances, this is also fine as mempools are locally-contexted anyways
  transactions.forEach(t => {
    const { transactionHash, nullifiers } = t;
    const nonZeroNullifiers = nullifiers.filter(n => n !== ZERO);
    // Is there a duplicate nullifier in our list of mempool: true and block transactions
    const duplicateSeenNullifier = nonZeroNullifiers.some(nz => nullifierSet.has(nz));
    // Is there a duplicate nullifier in our list of already spent nullifier
    const duplicateSpentNullifier = nonZeroNullifiers.some(nz => spentNullifierHashesSet.has(nz));
    if (duplicateSpentNullifier || duplicateSeenNullifier)
      invalidTransactionSet.add(transactionHash);
    else {
      nullifierSet.add(nonZeroNullifiers);
      maybeValidTransactions.push(t);
    }
  });

  // For valid transactions that have made it to this point, we run them through our transaction checker for validity
  for (let i = 0; i < maybeValidTransactions.length; i++) {
    let checkTransactionCorrect = true;
    try {
      // eslint-disable-next-line no-await-in-loop
      await checkTransaction(maybeValidTransactions[i]);
    } catch (error) {
      checkTransactionCorrect = false;
    }
    if (!checkTransactionCorrect) {
      logger.debug(`Invalid checkTransaction: ${maybeValidTransactions[i].transactionHash}`);
      invalidTransactionSet.add(maybeValidTransactions[i].transactionHash);
    }
  }
  const invalidTransactionHashesArr = [...invalidTransactionSet];
  logger.debug(`Deleting transactions: ${invalidTransactionHashesArr}`);
  await deleteTransactionsByTransactionHashes(invalidTransactionHashesArr);

  logger.debug(
    `Nullifier of deleted transactions: ${
      transactions.find(t => t.transactionHash === invalidTransactionHashesArr[0])?.nullifiers[0]
    }`,
  );

  // Once we have deleted transactions, we now need to delete any dangling nullifiers
  // We cannot just delete the nullifiers is invalid transactions, as they may duplicate of nullifiers we need.
  // Therefore we filter all the list of unspent nullifiers we retrieved from the database after resetting and rmeove
  // (1) nullifiers seen in valid transactions and
  // (2) nullifiers we saw while processing transactions.
  // The remaining nullifiers can be deleted
  const nullifierArray = [...nullifierSet];
  const validTransactions = transactions.filter(
    tx => !invalidTransactionHashesArr.includes(tx.transactionHash),
  );
  const validTransactionNullifiers = validTransactions.nullifiers.filter(n => n !== ZERO);

  const deletedNullifiers = unspentNullifierHashes.filter(
    un => !validTransactionNullifiers.includes(un) && !nullifierArray.includes(un),
  );
  await deleteNullifiers(deletedNullifiers);
  await dequeueEvent(2); // Remove an event from the stopQueue.
  // A Rollback triggers a NewCurrentProposer event which shoudl trigger queue[0].end()
  // But to be safe we enqueue a helper event to guarantee queue[0].end() runs.
  await enqueueEvent(() => logger.info(`Rollback Completed`), 0);
}

export default rollbackEventHandler;
