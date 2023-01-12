/**
Routes for setting and removing valid challenger addresses.
*/
import express from 'express';
import { flushQueue, queues } from '@polygon-nightfall/common-files/utils/event-queue.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { startMakingChallenges, stopMakingChallenges } from '../services/challenges.mjs';
import auth from '../utils/auth.mjs';

const router = express.Router();

/**
 * @openapi
 *  /challenger/enable:
 *    post:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Challenger
 *      summary: Enable a challenger.
 *      description: TBC
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      requestBody:
 *        $ref: '#/components/requestBodies/ChallengerEnable'
 *      responses:
 *        200:
 *          $ref: '#/components/responses/Success'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.post('/enable', auth, async (req, res, next) => {
  try {
    const { enable } = req.body;
    const result = enable === true ? startMakingChallenges() : stopMakingChallenges();
    res.json(result);

    if (queues[2].length === 0) {
      logger.info('After enabling challenges back, no challenges remain unresolved');
    } else {
      logger.info(
        `After enabling challenges back, there were ${queues[2].length} unresolved challenges. Running them now.`,
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
