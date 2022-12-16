/**
 * Module to handle new Transactions being posted
 */
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import {
  deleteDuplicateCommitmentsFromMemPool,
  deleteDuplicateNullifiersFromMemPool,
  saveTransaction,
} from '../services/database.mjs';
import { checkTransaction } from '../services/transaction-checker.mjs';
import TransactionError from '../classes/transaction-error.mjs';
import { getTransactionSubmittedCalldata } from '../services/process-calldata.mjs';

const { ZERO } = constants;

/**
 * This handler runs whenever a new transaction is submitted to the blockchain
 */
async function transactionSubmittedEventHandler(eventParams) {
  const { offchain = false, ...data } = eventParams;
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
    logger.info({ msg: 'Checking transaction validity...' });
    await checkTransaction({
      transaction,
      checkDuplicatesInL2: true,
      checkDuplicatesInMempool: true,
    });
    logger.info({ msg: 'Transaction checks passed' });

    const transactionCommitments = transaction.commitments.filter(c => c !== ZERO);
    const transactionNullifiers = transaction.nullifiers.filter(n => n !== ZERO);

    await deleteDuplicateCommitmentsFromMemPool(transactionCommitments);
    await deleteDuplicateNullifiersFromMemPool(transactionNullifiers);

    await saveTransaction({ ...transaction });
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
