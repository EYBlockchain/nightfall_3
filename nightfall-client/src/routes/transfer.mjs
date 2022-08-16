/**
Route for transferring a crypto commitment.
*/
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import transfer from '../services/transfer.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug(`transfer endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { rawTransaction: txDataToSign, transaction } = await transfer(req.body);
    logger.debug('returning raw transaction');
    logger.trace(` raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign, transaction });
  } catch (err) {
    logger.error(err);
    if (err.message.includes('No suitable commitments')) {
      logger.info('Returning "No suitable commitments" error');
      res.json({ error: 'No suitable commitments' });
    } else {
      next(err);
    }
  }
});

export default router;
