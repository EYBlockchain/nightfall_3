/**
Route for transferring a crypto commitment.
*/
import express from 'express';
import logger from '../utils/logger.mjs';
import transfer from '../services/transfer.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug(`transfer endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const txToSign = await transfer(req.body);
    logger.debug('returning raw transaction');
    logger.silly(` raw transaction is ${JSON.stringify(txToSign, null, 2)}`);
    res.json({ txToSign });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
