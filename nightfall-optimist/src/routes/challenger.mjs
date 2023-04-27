/**
Routes for setting and removing valid challenger addresses.
*/
import express from 'express';
import { flushQueue, queues } from 'common-files/utils/event-queue.mjs';
import logger from 'common-files/utils/logger.mjs';
import { startMakingChallenges, stopMakingChallenges } from '../services/challenges.mjs';

const router = express.Router();

router.post('/enable', async (req, res, next) => {
  try {
    const { enable } = req.body;
    const result = enable === true ? startMakingChallenges() : stopMakingChallenges();
    res.json(result);
    if (queues[2].length === 0) {
      logger.info('After enabling challenges back, no challenges remain unresolved');
    } else {
      logger.info(
        `After enabling challenges back, there were ${queues[2].length} unresolved challenges.  Running them now.`,
      );

      // start queue[2] and await all the unresolved challenges being run
      const p = flushQueue(2);
      queues[2].start();
      await p;
      logger.debug('All challenges in the stop queue have now been made.');
    }
  } catch (err) {
    next(err);
  }
});

export default router;
