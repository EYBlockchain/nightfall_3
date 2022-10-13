/**
Routes for setting and removing valid challenger addresses.
*/
import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { emptyQueue } from '@polygon-nightfall/common-files/utils/event-queue.mjs';
import { startMakingChallenges, stopMakingChallenges } from '../services/challenges.mjs';

const router = express.Router();

router.post('/enable', async (req, res, next) => {
  logger.debug('challenge endpoint received POST');
  try {
    const { enable } = req.body;
    const result =
      enable === true ? (emptyQueue(2), startMakingChallenges()) : stopMakingChallenges();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
