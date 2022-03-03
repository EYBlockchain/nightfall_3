/**
Routes for managing a proposer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import express from 'express';
import axios from 'axios';
import logger from '../../../../../common-files/utils/logger.mjs';

let optimistUrl = '';
const router = express.Router();

router.post('/offchain-transaction', async req => {
  console.log(`Proposer/offchain-transaction endpoint received POST`);
  console.log(`With content ${JSON.stringify(req.body, null, 2)}`);
  const { transaction } = req.body;

  if (!transaction) return;
  logger.debug(`offchain transaction - calling ${optimistUrl}/proposer/offchain-transaction`);
  await axios
    .post(`${optimistUrl}/proposer/offchain-transaction`, { transaction }, { timeout: 3600000 })
    .catch(err => {
      throw new Error(err);
    });
});

function setOptimistUrl(url) {
  logger.debug(`Optimist URL: ${url}`);
  optimistUrl = url;
}

export { router, setOptimistUrl };
