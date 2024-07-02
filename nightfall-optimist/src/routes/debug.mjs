import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { getDebugCounters } from '../services/debug-counters.mjs';
import { setEnableHeartBeatLogging } from '../services/block-assembler.mjs';

const router = express.Router();

router.get('/counters', async (req, res, next) => {
  try {
    const counters = getDebugCounters();
    res.json({ counters });
  } catch (err) {
    next(err);
  }
});

router.post('/toggle-heartbeat-logging', async (req, res, next) => {
  const heartBeatLogging = req?.body?.heartBeatLogging === 'true' || false;

  try {
    logger.info(`Setting heartbeat logging to ${heartBeatLogging}`);
    setEnableHeartBeatLogging(heartBeatLogging);
    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
});

export default router;
