import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { getDebugCounters } from '../services/debug-counters.mjs';

const router = express.Router();

router.get('/counters', async (req, res, next) => {
  logger.debug('counters endpoint received GET');
  try {
    const counters = getDebugCounters();
    res.json({ counters });
  } catch (err) {
    next(err);
  }
});

export default router;
