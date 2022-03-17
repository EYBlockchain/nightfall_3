/**
Module to handle new Transactions being posted
*/
import logger from 'common-files/utils/logger.mjs';
import {
  saveTransaction,
  retrieveNullifiers,
  saveNullifiers,
  getBlockByTransactionHash,
  getTransactionByTransactionHash,
  getPaymentByPaymentTransactionHash,
  savePayment,
} from '../services/database.mjs';
// import mappedTransaction from '../event-mappers/transaction-submitted.mjs';
import checkTransaction from '../services/transaction-checker.mjs';
import TransactionError from '../classes/transaction-error.mjs';
import { getTransactionSubmittedCalldata } from '../services/process-calldata.mjs';

/**
it's possible this is a replay or a re-mine of a transaction that's already
in a block. Check for this.  This is not part of the general transaction
check because we don't want to do it as part of the block check, only when the
transaction is received. If we did it as part of the block check it would fail
because at that point we're bound to have the transaction both in the mempool and
in the block.
*/
async function checkAlreadyInBlock(_transaction) {
  const transaction = { ..._transaction };
  const [block] = await getBlockByTransactionHash(transaction.transactionHash);
  if (!block) return transaction; // all ok, we've not seen this before
  const storedTransaction = await getTransactionByTransactionHash(transaction.transactionHash);
  if (storedTransaction.blockNumber)
    // it's a re-play of an existing transaction that's in a block
    throw new TransactionError('This transaction has been processed previously', 6);
  // it's a re-mine of an existing transaction that's in a block
  transaction.mempool = false; // we don't want to put it in another block or we'll get a duplicate transaction challenge
  logger.debug(
    `Transaction ${transaction.transactionHash} has been re-mined but is already in a block - setting mempool to false`,
  );
  return transaction; // but it's otherwise ok
}

/**
Check that the payment is not already in another transaction
*/
async function checkPayment(paymentTransactionHash) {
  if (!paymentTransactionHash)
    throw new TransactionError('There is no payment for this transaction', 7);
  const isAlreadyPaid = !!(await getPaymentByPaymentTransactionHash(paymentTransactionHash));
  if (isAlreadyPaid)
    throw new TransactionError('This payment has already been used in another transaction', 8);
  return true;
}

/**
This handler runs whenever a new transaction is submitted to the blockchain
*/
async function transactionSubmittedEventHandler(eventParams) {
  const { offchain = false, paymentTransactionHash = null, ...data } = eventParams;
  logger.info(
    `Transaction offchain: ${offchain}, Payment transactionHash: ${paymentTransactionHash}`,
  );
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
  logger.info(`Transaction Handler - New transaction received.`);
  logger.debug(`Transaction was ${JSON.stringify(transaction, null, 2)}`);
  try {
    if (offchain) await checkPayment(paymentTransactionHash); // Check if the payment tx hash is already in another transaction
    transaction = await checkAlreadyInBlock(transaction);
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
    if (transactionNullifiers.length > 0)
      saveNullifiers(transactionNullifiers, transaction.blockNumber); // we can now safely store the nullifiers IFF they are present
    saveTransaction({ ...transaction }); // then we need to save it
    if (offchain) savePayment(paymentTransactionHash, transaction.transactionHash);
  } catch (err) {
    if (err instanceof TransactionError)
      logger.warn(
        `The transaction check failed with error: ${err.message}. The transaction has been ignored`,
      );
    else logger.error(err.stack);
  }
}

export default transactionSubmittedEventHandler;
