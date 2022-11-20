import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { advanceWithdrawal } from '../services/instant-withdrawal.mjs';
import auth from '../utils/auth.mjs';

const router = express.Router();

/**
 * @openapi
 *  /transaction/advanceWithdrawal:
 *    post:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Transaction
 *      summary: Advance Withdrawal.
 *      description: Request an advanced withdrawal from a liquidity provider.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      requestBody:
 *        $ref: '#/components/requestBodies/AdvanceWithdrawal'
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessAdvanceWithdrawal'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.post('/advanceWithdrawal', auth, async (req, res, next) => {
  try {
    const { transactionHash } = req.body;
    logger.info({ msg: 'Performing advanceWithdraw', transactionHash });
    const result = await advanceWithdrawal(transactionHash);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
