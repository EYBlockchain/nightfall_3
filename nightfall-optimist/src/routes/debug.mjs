import express from 'express';
import { getDebugCounters } from '../services/debug-counters.mjs';
import auth from '../utils/auth.mjs';

const router = express.Router();

/**
 * @openapi
 *  /debug/counters:
 *    post:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Debug
 *      summary: Debug counters.
 *      description: Route that will return the debug counters.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessDebugContract'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.get('/counters', auth, async (req, res, next) => {
  try {
    const counters = getDebugCounters();
    res.json({ counters });
  } catch (err) {
    next(err);
  }
});

export default router;
