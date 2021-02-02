/**
Module to handle new Transactions being posted
*/
import logger from '../utils/logger.mjs';
import { saveTransaction } from '../services/database.mjs';
// import { conditionalMakeBlock } from '../services/propose-block.mjs';
import mappedTransaction from '../event-mappers/transaction-submitted.mjs';

/**
This handler runs whenever a new transaction is submitted to the blockchain
*/
async function transactionSubmittedEventHandler(data) {
  const transaction = mappedTransaction(data);
  saveTransaction(transaction); // all we need to do here is save it
  logger.info(`New transaction submitted.`);
}

export default transactionSubmittedEventHandler;
