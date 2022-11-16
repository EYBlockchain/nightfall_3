import express from 'express';
import { checkBlock } from '../services/check-block.mjs';
import Block from '../classes/block.mjs';
import { resetUnsuccessfulBlockProposedTransactions } from '../services/database.mjs';
import { setMakeNow } from '../services/block-assembler.mjs';
import auth from '../utils/auth.mjs';

const router = express.Router();

/**
 * @openapi
 *  components:
 *    schemas:
 *      Block:
 *        type: object
 *        properties:
 *          _id:
 *            type: string
 *          blockHash:
 *            type: string
 *          blockNumber:
 *            type: number
 *          blockNumberL2:
 *            type: number
 *          frontierHash:
 *            type: string
 *          leafCount:
 *            type: number
 *          nCommitments:
 *            type: number
 *          previousBlockHash:
 *            type: string
 *          proposer:
 *            type: string
 *          root:
 *            type: string
 *          timeBlockL2:
 *            type: string
 *          transactionHashL1:
 *            type: string
 *          transactionHashes:
 *            type: array
 *            items:
 *              type: string
 *          transactionHashesRoot:
 *            type: string
 *      BlockToBeChecked:
 *        type: object
 *        properties:
 *          block:
 *            type: object
 *          transactions:
 *            type: array
 *      Transaction:
 *        type: object
 *        properties:
 *          value:
 *            type: string
 *          fee:
 *            type: string
 *          transactionType:
 *            type: string
 *          tokenType:
 *            type: string
 *          historicRootBlockNumberL2:
 *            type: array
 *            items:
 *              type: string
 *          historicRootBlockNumberL2Fee:
 *            type: array
 *            items:
 *              type: string
 *          tokenId:
 *            type: string
 *          ercAddress:
 *            type: string
 *          recipientAddress:
 *            type: string
 *          commitments:
 *            type: array
 *            items:
 *              type: string
 *          nullifiers:
 *            type: array
 *            items:
 *              type: string
 *          commitmentFee:
 *            type: array
 *            items:
 *              type: string
 *          nullifiersFee:
 *            type: array
 *            items:
 *              type: string
 *          compressedSecrets:
 *            type: array
 *            items:
 *              type: string
 *          proof:
 *            type: array
 *            items:
 *              type: string
 *          transactionHash:
 *            type: string
 */

/**
 * @openapi
 *  /block/check:
 *    post:
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Block
 *      summary: Current proposer.
 *      description: Returns the current proposer.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/BlockToBeChecked'
 *      responses:
 *        200:
 *          description: Block without inconsistency.
 *        401:
 *          $ref: '#/components/responses/UnauthorizedError'
 *        500:
 *          description: Some inconsistency was found.
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
 *      description: Responsible to call the function that will generate a new block.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      responses:
 *        200:
 *          description: Making short block.
 *        401:
 *          $ref: '#/components/responses/UnauthorizedError'
 *        500:
 *          description: Some inconsistency was found.
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
 *      description: Route that reset a local block.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
 *      responses:
 *        200:
 *          description: Block reseted.
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  block:
 *                    resetstatus: boolean
 *                    example: true
 *        401:
 *          $ref: '#/components/responses/UnauthorizedError'
 *        500:
 *          description: Some error ocurred.
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
