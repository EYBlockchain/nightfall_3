/**
 * Module to handle new Transactions being posted
 */
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { saveTransaction } from '../services/database.mjs';
import checkTransaction from '../services/transaction-checker.mjs';
import TransactionError from '../classes/transaction-error.mjs';
import { getTransactionSubmittedCalldata } from '../services/process-calldata.mjs';

/**
 * This handler runs whenever a new transaction is submitted to the blockchain
 */
async function transactionSubmittedEventHandler(eventParams) {
  const { offchain = false, fromBlockProposer = false, blockNumberL2 = -1, ...data } = eventParams;
  let transaction;
  if (offchain) {
    transaction = data;
    transaction.blockNumber = 'offchain';
    transaction.transactionHashL1 = 'offchain';
  } else {
    transaction = await getTransactionSubmittedCalldata(data);
    transaction.blockNumber = data.blockNumber;
    transaction.transactionHashL1 = data.transactionHash;
  }

  logger.info({
    msg: 'Transaction Handler - New transaction received.',
    transaction,
  });

  try {
    // the transaction is received from block proposer event handler, save first and then check for validity
    // otherwise (received from client directly or from smart contract's submitTransaction)
    // don't save if the transaction is not valid.
    if (fromBlockProposer) {
      await saveTransaction({ ...transaction, blockNumberL2 });
      logger.info({ msg: 'Checking transaction validity...' });
      await checkTransaction(transaction, true);
      logger.info({ msg: 'Transaction checks passed' });
    } else {
      logger.info({ msg: 'Checking transaction validity...' });
      await checkTransaction(transaction, true);
      logger.info({ msg: 'Transaction checks passed' });
      await saveTransaction({ ...transaction });
    }
  } catch (err) {
    if (err instanceof TransactionError) {
      logger.warn(
        `The transaction check failed with error: ${err.message}. The transaction has been ignored`,
      );
    } else {
      logger.error(err);
    }
  }
}

export default transactionSubmittedEventHandler;
