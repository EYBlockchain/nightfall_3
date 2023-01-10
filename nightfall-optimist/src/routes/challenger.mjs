/**
Routes for setting and removing valid challenger addresses.
*/
import express from 'express';
import { flushQueue, queues } from '@polygon-nightfall/common-files/utils/event-queue.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { startMakingChallenges, stopMakingChallenges } from '../services/challenges.mjs';
import { insertNewChallenger } from '../services/database.mjs';

const router = express.Router();

/**
 * register API for now store challenger data in db
 */
router.post('/register', async (req, res, next) => {
  const { address } = req.body;
  try {
    const result = await insertNewChallenger(address);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

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
