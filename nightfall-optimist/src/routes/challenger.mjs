/**
Routes for setting and removing valid challenger addresses.
*/
import express from 'express';
import { emptyQueue } from '@polygon-nightfall/common-files/utils/event-queue.mjs';
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
 *      - Challanger
 *      summary: Enable a challenger.
 *      description: .
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
    const result =
      enable === true ? (emptyQueue(2), startMakingChallenges()) : stopMakingChallenges();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
