/**
Each time the Shield contract removes a block from the blockHash linked-list,
as a result of a rollback, this event gets fired.  We can use it to remove the
same blocks from our local database record and to reset cached Frontier and
leafCount values in the Block class
*/
import logger from 'common-files/utils/logger.mjs';
import config from 'config';
import {
  addTransactionsToMemPool,
  deleteBlock,
  findBlocksFromBlockNumberL2,
  resetNullifiers,
  // deleteTransferAndWithdraw,
  getMempoolTransactions,
  deleteTransactionsByTransactionHashes,
  retrieveNullifiers,
} from '../services/database.mjs';
import Block from '../classes/block.mjs';
import checkTransaction from '../services/transaction-checker.mjs';
import { getLeafCount } from '../utils/timber.mjs';

const { ZERO } = config;

async function rollbackEventHandler(data) {
  const { blockNumberL2, leafCount } = data.returnValues;
  logger.info(`Received Rollback event, with layer 2 block number ${blockNumberL2}`);
  // reset the Block class cached values.
  Block.rollback();
  /*
   We have to remove all blocks from our database which have a layer 2 block
   number >= blockNumberL2, because the blockchain will have deleted these due
   to a successful challenge. First we find and then process them.
   Return deposit transactions in the rolled back block to the mempool so that
   they can be picked up again by a new Proposer, but delete transfer and
   withdraw transactions because we cannot guarantee that these won't be re-
   proposed before the corresponding transaction that creates the input
   commitments.  If that were to happen, the block would become challengable
   even if the Proposer acted in good faith.  Deleteing them obvously prevents
   this but means that the Transactor looses their fee payment.  TODO fix this,
   but for now it will do because the fee isn't much and this should be a rare
   event.
   Also delete nullifiers and the blocks that no longer exist.
  */

  // This is bad
  // Optimist does not actually need timber to catch up
  // However, this slows down optimist enough that timber and optimist can rollback
  // before timber updates from the new block.
  let timberLeafCount;
  do {
    // eslint-disable-next-line no-await-in-loop
    timberLeafCount = await getLeafCount();
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 3000));
  } while (Number(timberLeafCount) !== Number(leafCount));

  // From the rolled back blocks, we delete the blocks and unset transactions + nullifiers
  await Promise.all(
    (
      await findBlocksFromBlockNumberL2(blockNumberL2)
    )
      .map(async block => [
        // deleteTransferAndWithdraw(block.transactionHashes).then(() =>
        addTransactionsToMemPool(block),
        // ),
        resetNullifiers(block.blockHash),
        deleteBlock(block.blockHash),
      ])
      .flat(1),
  );

  // Get the nullifiers we have stored
  const storedNullifiers = await retrieveNullifiers();
  const storedNullifiersHash = storedNullifiers.map(sNull => sNull.hash);

  // Filter out deposits and sort by blockNumber order
  const mempool = (await getMempoolTransactions())
    .filter(m => m.transactionType !== '0')
    .sort((a, b) => a.blockNumber - b.blockNumber);

  const toBeDeleted = [];

  for (let i = 0; i < mempool.length; i++) {
    const transaction = mempool[i];
    // We only care about nullifiers that are not null
    const transactionNullifiers = transaction.nullifiers.filter(hash => hash !== ZERO);
    // Set this bool to true, we modify it if we catch the error from checkTransaction
    let checkTransactionCorrect = true;
    try {
      logger.info(`Test`);
      // eslint-disable-next-line no-await-in-loop
      await checkTransaction(transaction);
    } catch (err) {
      logger.info(`CAUGHT`);
      checkTransactionCorrect = false;
    }
    // Perform the nullifier check, i.e. see if this transaction has a duplicate nullifier
    // We have not deleted the nullifier collection, so the presence of a transacaction nullifier in the nullifier list is insufficient
    // Instead, check if the blockNumber we saw the transaction come from matches the blockNumber we saw the nullifier.
    logger.info(`Doing DupNullifier Check`);
    const dupNullifier = transactionNullifiers.some(txNull => {
      if (storedNullifiersHash.includes(txNull)) {
        const alreadyStoredNullifier = storedNullifiers.find(s => s.hash === txNull);
        logger.info(`alreadyStoredNullifier: ${JSON.stringify(alreadyStoredNullifier)}`);
        return alreadyStoredNullifier.blockNumber !== transaction.blockNumber;
      }
      return false;
    });
    // If we found a duplicate nullifier or if the checkTransactionCorrect is false
    // we queue the transaction hash for deletion.
    if (dupNullifier || !checkTransactionCorrect) {
      toBeDeleted.push(transaction.transactionHash);
    }
  }

  logger.info(`Deleting from Mempool: ${toBeDeleted}`);
  return deleteTransactionsByTransactionHashes(toBeDeleted);
}

export default rollbackEventHandler;
