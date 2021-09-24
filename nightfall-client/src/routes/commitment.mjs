/**
 Route for commitment to access commitment data from the database
 */

import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { getCommitmentBySalt, getWalletBalance } from '../services/commitment-storage.mjs';

const router = express.Router();

router.get('/salt', async (req, res, next) => {
  logger.debug('commitment/salt endpoint received GET');
  try {
    const { salt } = req.query;
    const commitment = await getCommitmentBySalt(salt);
    logger.debug(`Found commitment ${commitment} for salt ${salt}`);
    res.json({ commitment });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

router.get('/balance', async (req, res, next) => {
  logger.debug('commitment/balance endpoint received GET');
  try {
    const balance = await getWalletBalance();
    res.json({ balance });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
