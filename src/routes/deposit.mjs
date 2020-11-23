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
    const { rawTransaction: txToSign, commitment } = await deposit(req.body);
    logger.debug('returning raw transaction');
    logger.silly(` raw transaction is ${JSON.stringify(txToSign, null, 2)}`);
    // convert commitment from GN to hex form for transmission
    res.json({ txToSign, commitment: commitment.toHex() });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
