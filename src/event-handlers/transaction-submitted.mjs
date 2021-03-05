/**
Module to handle new Transactions being posted
*/
import logger from '../utils/logger.mjs';
import { saveTransaction } from '../services/database.mjs';
// import { conditionalMakeBlock } from '../services/block-assembler.mjs';
import mappedTransaction from '../event-mappers/transaction-submitted.mjs';
import checkTransaction from '../services/transaction-checker.mjs';
import TransactionError from '../classes/transaction-error.mjs';

/**
This handler runs whenever a new transaction is submitted to the blockchain
*/
async function transactionSubmittedEventHandler(data) {
  const transaction = mappedTransaction(data);
  logger.info(`Transaction Handler - New transaction submitted.`);
  logger.debug(`Transaction was ${JSON.stringify(transaction, null, 2)}`);
  // check that this is a valid transaction before we incorporate it into our
  // mempool
  try {
    await checkTransaction(transaction); // TODO handle errors
    logger.info('Transaction checks passed');
    saveTransaction(transaction); // then we need to save it
  } catch (err) {
    if (err instanceof TransactionError)
      logger.warn(
        `The transaction check failed with error: ${err.message}. The transaction has been ignored`,
      );
    else logger.error(err.message);
  }
}

export default transactionSubmittedEventHandler;
