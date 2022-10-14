/**
Route for transferring a crypto commitment.
*/
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import withdraw from '../services/withdraw.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  const filteredReq = JSON.stringify(
    {
      ...req.body,
      rootKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
    },
    null,
    2,
  );
  logger.debug(`withdraw endpoint received POST ${filteredReq}`);
  try {
    const { rawTransaction: txDataToSign, transaction } = await withdraw(req.body);
    logger.debug('returning raw transaction');
    logger.trace(` raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    res.json({ txDataToSign, transaction });
  } catch (err) {
    if (err.message.includes('invalid commitment hashes')) {
      logger.info('Returning "invalid commitment hashes" error');
      res.json({ error: err.message });
    }
    logger.error(err);
    next(err);
  }
});

export default router;
