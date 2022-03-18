/**
Routes for managing a proposer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import express from 'express';
import logger from '../../../../../common-files/utils/logger.mjs';
import { sendOffchainTransaction } from '../nf3-wrapper.mjs';

const router = express.Router();

router.post('/offchain-transaction', async (req, res) => {
  logger.debug(`Proposer/offchain-transaction endpoint received POST`);
  logger.debug(`With content ${JSON.stringify(req.body, null, 2)}`);
  const { transaction } = req.body;

  if (!transaction) {
    res.sendStatus(404);
    return;
  }
  await sendOffchainTransaction(transaction);
  res.sendStatus(200);
});

export default router;
