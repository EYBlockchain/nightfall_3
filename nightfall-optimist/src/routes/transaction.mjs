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

export default router;
