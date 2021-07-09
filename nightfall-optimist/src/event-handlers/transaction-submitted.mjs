/**
Module to handle new Transactions being posted
*/
import logger from '../utils/logger.mjs';
import { saveTransaction, retrieveNullifiers, saveNullifiers } from '../services/database.mjs';
// import mappedTransaction from '../event-mappers/transaction-submitted.mjs';
import checkTransaction from '../services/transaction-checker.mjs';
import TransactionError from '../classes/transaction-error.mjs';
import { getTransactionSubmittedCalldata } from '../services/process-calldata.mjs';

/**
This handler runs whenever a new transaction is submitted to the blockchain
*/
async function transactionSubmittedEventHandler(eventParams) {
  // const transaction = mappedTransaction(data);
  const { offchain = false, blockNumber, ...data } = eventParams;
  let transaction;
  if (offchain) transaction = data;
  else transaction = await getTransactionSubmittedCalldata(data);
  logger.info(`Transaction Handler - New transaction received.`);
  logger.debug(`Transaction was ${JSON.stringify(transaction, null, 2)}`);
  // check that this is a valid transaction before we incorporate it into our
  // mempool
  try {
    await checkTransaction(transaction);
    logger.info('Transaction checks passed');
    const storedNullifiers = (await retrieveNullifiers()).map(sNull => sNull.hash); // List of Nullifiers stored by blockProposer
    const transactionNullifiers = transaction.nullifiers.filter(
      hash => hash !== '0x0000000000000000000000000000000000000000000000000000000000000000',
    ); // Deposit transactions still have nullifier fields but they are 0
    const dupNullifier = transactionNullifiers.some(txNull => storedNullifiers.includes(txNull)); // Move to Set for performance later.
    if (dupNullifier) {
      throw new TransactionError(
        'One of the Nullifiers in the transaction is a duplicate! Dropping tx',
        1,
      );
    }
    if (transactionNullifiers.length > 0) saveNullifiers(transactionNullifiers, blockNumber); // we can now safely store the nullifiers IFF they are present
    saveTransaction({ ...transaction, blockNumber }); // then we need to save it
  } catch (err) {
    if (err instanceof TransactionError)
      logger.warn(
        `The transaction check failed with error: ${err.message}. The transaction has been ignored`,
      );
    else logger.error(err.stack);
  }
}

export default transactionSubmittedEventHandler;
