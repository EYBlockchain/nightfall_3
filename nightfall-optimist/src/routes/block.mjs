import express from 'express';
import { checkBlock } from '../services/check-block.mjs';
import Block from '../classes/block.mjs';
import { resetUnsuccessfulBlockProposedTransactions } from '../services/database.mjs';
import { setMakeNow } from '../services/block-assembler.mjs';
import auth from '../utils/auth.mjs';

const router = express.Router();

/**
 * @openapi
 *  /block/check:
 *    post:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Block
 *      summary: Check Block.
 *      description: Check a specific block.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      requestBody:
 *        $ref: '#/components/requestBodies/CheckBlock'
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessBlockChecked'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.post('/check', auth, async (req, res, next) => {
  try {
    const { block, transactions } = req.body;
    const result = await checkBlock(block, transactions);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 *  /block/make-now:
 *    get:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Block
 *      summary: Make block.
 *      description: Set flag makeNow to true, to trigger the creation of a new block.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessBlockCreated'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.get('/make-now', auth, async (req, res, next) => {
  try {
    setMakeNow();
    res.send('Making short block');
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 *  /block/reset-localblock:
 *    get:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Block
 *      summary: Reset local block.
 *      description: Reset transactions from unsuccessful block proposed.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      responses:
 *        200:
 *          $ref: '#/components/responses/SuccessBlockReset'
 *        401:
 *          $ref: '#/components/responses/Unauthorized'
 *        500:
 *          $ref: '#/components/responses/InternalServerError'
 */
router.get('/reset-localblock', auth, async (req, res, next) => {
  try {
    await Block.rollback();
    await resetUnsuccessfulBlockProposedTransactions();
    res.json({ resetstatus: true });
  } catch (err) {
    next(err);
  }
});

export default router;
