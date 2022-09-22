import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { advanceWithdrawal } from '../services/instant-withdrawal.mjs';
import { getTransactionByTransactionHash } from '../services/database.mjs';

const router = express.Router();

router.post('/advanceWithdrawal', async (req, res, next) => {
  try {
    const { transactionHash } = req.body;

    const withdrawTransaction = await getTransactionByTransactionHash(transactionHash);

    logger.info({ msg: 'Performing advanceWithdraw', transactionHash, withdrawTransaction });

    const result = await advanceWithdrawal(withdrawTransaction);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
