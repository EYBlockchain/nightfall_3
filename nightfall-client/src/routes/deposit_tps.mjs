/**
Route for depositing (minting) a crypto commitment.
This code assumes that the Shield contract already has approval to spend
funds on a zkp deposit
*/
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import deposit from '../services/deposit_tps.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { rawTransaction: txDataToSign, transaction } = await deposit(req.body);

    res.json({ txDataToSign, transaction });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
