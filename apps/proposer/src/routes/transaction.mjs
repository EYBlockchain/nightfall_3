/**
Routes for managing transactions.
*/
import express from 'express';
import logger from '../../../../common-files/utils/logger.mjs';

const router = express.Router();

router.get('/transaction-hash/:transactionHash', async (req, res) => {
  const nf3 = req.app.get('nf3');
  logger.debug('block endpoint received get');
  const { transactionHash } = req.body;
  if (!transactionHash) {
    res.sendStatus(404);
    return;
  }
  // get data to return
  const transaction = await nf3.getTransactionByTransactionHash(transactionHash);
  res.json({ transaction });
});

export default router;
