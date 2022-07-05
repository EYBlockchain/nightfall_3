/**
Routes for setting and removing valid challenger addresses.
*/
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { advanceWithdrawal } from '../services/instant-withdrawal.mjs';
import { getTransactionByTransactionHash } from '../services/database.mjs';

const router = express.Router();

router.post('/advanceWithdrawal', async (req, res, next) => {
  logger.debug('add endpoint received POST');
  try {
    const { transactionHash } = req.body;
    console.log('TRANSACTIONHASH', transactionHash);
    const withdrawTransaction = await getTransactionByTransactionHash(transactionHash);
    console.log('WITHDRAWTRANSACTION', withdrawTransaction);
    const result = await advanceWithdrawal(withdrawTransaction);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/transaction-hash/:transactionHash', async (req, res, next) => {
  logger.debug('block endpoint received get');
  try {
    const { transactionHash } = req.params;
    logger.debug(`searching for block containing transaction hash ${transactionHash}`);
    // get data to return
    const transaction = await getTransactionByTransactionHash(transactionHash);
    if (transaction) {
      logger.debug(`Found transaction ${JSON.stringify(transaction, null, 2)} in database`);
      res.json({ transaction });
    } else {
      logger.debug('Transaction not found');
      res.json({ transaction: null });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
