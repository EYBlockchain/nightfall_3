/**
Route for depositing (minting) a crypto commitment.
This code assumes that the Shield contract already has approval to spend
funds on a zkp deposit
*/
import express from 'express';
import logger from '../utils/logger.mjs';
import deposit from '../services/deposit.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug(`deposit endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    res.json({ txToSign: await deposit(req.body) });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
