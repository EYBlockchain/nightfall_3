import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { advanceWithdrawal } from '../services/instant-withdrawal.mjs';
import auth from '../utils/auth.mjs';

const router = express.Router();

router.post('/advanceWithdrawal', auth, async (req, res, next) => {
  try {
    const { transactionHash } = req.body;
    logger.info({ msg: 'Performing advanceWithdraw', transactionHash });
    const result = await advanceWithdrawal(transactionHash);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
