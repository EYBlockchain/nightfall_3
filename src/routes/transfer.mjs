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
    const { rawTransaction: txToSign, commitments } = await transfer(req.body);
    logger.debug('returning raw transaction');
    logger.silly(` raw transaction is ${JSON.stringify(txToSign, null, 2)}`);
    // convert commitment from GN to hex form for transmission
    res.json({ txToSign, commitments: commitments.map(commitment => commitment.toHex()) });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
