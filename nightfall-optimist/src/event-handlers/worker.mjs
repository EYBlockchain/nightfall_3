/**
 * Module to handle new Transactions being posted
 */
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { parentPort, workerData } from 'worker_threads';

/**
 * Module to handle new Transactions being posted
 */

import {
  saveTransaction,
  getBlockByTransactionHash,
  getTransactionByTransactionHash,
} from '../services/database2.mjs';

import checkTransaction from '../services/transaction-checker2.mjs';

import TransactionError from '../classes/transaction-error.mjs';
// import { getTransactionSubmittedCalldata } from '../services/process-calldata.mjs';

function getNextGeneration(a, b) {
  return a + b;
}

/**
 * It's possible this is a replay or a re-mine of a transaction that's already
 * in a block. Check for this.  This is not part of the general transaction
 * check because we don't want to do it as part of the block check, only when the
 * transaction is received. If we did it as part of the block check it would fail
 * because at that point we're bound to have the transaction both in the mempool and
 * in the block.
 */

async function checkAlreadyInBlock(_transaction) {
  const transaction = { ..._transaction };
  const [block] = await getBlockByTransactionHash(transaction.transactionHash);

  if (!block) return transaction; // all ok, we've not seen this before

  const storedTransaction = await getTransactionByTransactionHash(transaction.transactionHash);

  if (storedTransaction?.blockNumber) {
    // it's a re-play of an existing transaction that's in a block
    throw new TransactionError('This transaction has been processed previously', 6);
  }

  // it's a re-mine of an existing transaction that's in a block
  transaction.mempool = false; // we don't want to put it in another block or we'll get a duplicate transaction challenge

  logger.debug({
    msg: 'Transaction has been re-mined but is already in a block - mempool set to false',
    transactionHash: transaction.transactionHash,
  });

  return transaction; // but it's otherwise ok
}

/**
 * This handler runs whenever a new transaction is submitted to the blockchain
 */

async function transactionSubmittedEventHandler(_transaction, fromBlockProposer) {
  const start = new Date();
  logger.info({
    msg: 'Transaction Handler - New transaction received.',
    transaction: JSON.stringify(_transaction, null, 2),
  });

  try {
    const startCheckInBlock = new Date();
    const transaction = await checkAlreadyInBlock(_transaction);
    const endCheckInBlock = new Date();
    const startSave1 = new Date();
    // save transaction if not in block
    if (fromBlockProposer) {
      saveTransaction({ ...transaction });
    }
    const endSave1 = new Date();

    const startCheckTx = new Date();
    console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    // const res = await checkTxPool.exec(transaction, true);
    // console.log("XXXXXXXXXXXXXXX", res)
    await checkTransaction(transaction, true);
    const endCheckTx = new Date();
    logger.info('Transaction checks passed');

    // save it
    const startSave2 = new Date();
    if (!fromBlockProposer) {
      saveTransaction({ ...transaction });
    }
    const endSave2 = new Date();
    const end = new Date();
    console.log(
      'TX HANDLER TIME:',
      end.getTime() - start.getTime(),
      endCheckInBlock.getTime() - startCheckInBlock.getTime(),
      endSave1.getTime() - startSave1.getTime(),
      endCheckTx.getTime() - startCheckTx.getTime(),
      endSave2.getTime() - startSave2.getTime(),
    );
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

console.log('XXXXXXXXXXXXX', workerData.transaction, workerData.fromBlockProposer);
const result = getNextGeneration(3, 4);
await transactionSubmittedEventHandler(
  workerData.transaction,
  workerData.fromBlockProposer
);
parentPort.postMessage(result);
