/**
 * Module to handle new Transactions being posted
 */
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { StaticPool } from 'node-worker-threads-pool';
import { fileURLToPath } from 'url';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import gen from 'general-number';
import {
  saveTransaction,
  getBlockByTransactionHash,
  getTransactionByTransactionHash,
} from '../services/database.mjs';
import checkTransaction from '../services/transaction-checker.mjs';
import TransactionError from '../classes/transaction-error.mjs';
import { getTransactionSubmittedCalldata } from '../services/process-calldata.mjs';

const __filename = fileURLToPath(import.meta.url);
const init = false;
let checkTxPool;
let worker;

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
async function transactionSubmittedEventHandler(eventParams) {
  /*
  if (!init) {
    console.log("XXXXXXXXXXXXXXX INIT XXXXXXXXXXXXX", __filename)
    checkTxPool = new StaticPool({
      size: 4,
       task: '/app/src/services/transaction-checker.mjs',
      //task: __filename,
      // task: (a,b) => 
    });
    init = true;
  }
  */
  const { offchain = false, fromBlockProposer, ...data } = eventParams;
  const { generalise } = gen;
  const start = new Date();
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
    transaction: JSON.stringify(transaction, null, 2),
  });
  // if (isMainThread) {
  // worker = new Worker(__filename);
  worker = new Worker('/app/src/event-handlers/worker.mjs', {
    workerData: { transaction, fromBlockProposer},
  });
  worker.on('message', msg => {
    console.log('SSSSSSSSSSSSSSSSSSSSSSSS', msg);
  });
  worker.on('error', err => {
    console.log('XXXXXXXXXXXXX', err);
  });
  /*
  } else {
    logger.info({
      msg: 'Transaction Handler - New transaction received.',
      transaction: JSON.stringify(transaction, null, 2),
    });

    try {
      const startCheckInBlock = new Date();
      transaction = await checkAlreadyInBlock(transaction);
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
  } */
  /* } else if (!isMainThread) {
    console.log('XXXXXXXXXX');
    //parentPort.postMessage('DONE');
  } */
}

export default transactionSubmittedEventHandler;
