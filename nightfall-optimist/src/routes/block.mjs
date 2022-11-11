/**
 * Routes for checking that a block is valid.
 */
import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { flushQueue } from '@polygon-nightfall/common-files/utils/event-queue.mjs';
import { checkBlock } from '../services/check-block.mjs';
import Block from '../classes/block.mjs';
import {
  getBlockByTransactionHash,
  getBlockByRoot,
  getTransactionsByTransactionHashes,
  resetUnsuccessfulBlockProposedTransactions,
} from '../services/database.mjs';
import { setMakeNow } from '../services/block-assembler.mjs';

const router = express.Router();

/**
 * @openapi
 *  components:
 *    schemas:
 *      BlockToBeChecked:
 *        type: object
 *        properties:
 *          block:
 *            type: object
 *          transactions:
 *            type: array
 */

/**
 * @openapi
 *  /block/check:
 *    post:
 *      tags:
 *      - Block
 *      summary: Current proposer.
 *      description: Returns the current proposer.
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/BlockToBeChecked'
 *      responses:
 *        200:
 *          description: Block without inconsistency.
 *        500:
 *          description: Some inconsistency was found.
 */
router.post('/check', async (req, res, next) => {
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
 *      tags:
 *      - Block
 *      summary: Make block.
 *      description: Responsible to call the function that will generate a new block.
 *      responses:
 *        200:
 *          description: Making short block.
 *        500:
 *          description: Some inconsistency was found.
 */
router.get('/make-now', async (req, res, next) => {
  try {
    setMakeNow();
    res.send('Making short block');
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 *  /block/transaction-hash/{transactionHash}:
 *    get:
 *      tags:
 *      - Block
 *      summary: Block by transaction hash.
 *      description: Returns the block, its transaction and the index by transaction hash.
 *      parameters:
 *        - in: path
 *          name: transactionHash
 *          required: true
 *          schema:
 *            type: string
 *            description: Transaction hash
 *      responses:
 *        200:
 *          description: Block and transactions returned.
 *          content:
 *            application/json:
 *              schema:
 *                oneOf:
 *                  - type: object
 *                    properties:
 *                      block:
 *                        type: object
 *                        example: {}
 *                      transactions:
 *                        type: array
 *                        example: []
 *                      index:
 *                        type: number
 *                        example: 1
 *                  - type: object
 *                    properties:
 *                      block:
 *                        type: object
 *                        example: null
 *                      transactions:
 *                        type: array
 *                        example: null
 *                      index:
 *                        type: number
 *                        example: null
 *        500:
 *          description: Some error ocurred.
 */
router.get('/transaction-hash/:transactionHash', async (req, res, next) => {
  try {
    const { transactionHash } = req.params;
    logger.debug(`searching for block containing transaction hash ${transactionHash}`);

    // get data to return
    const [block] = await getBlockByTransactionHash(transactionHash);

    if (block) {
      const transactions = await getTransactionsByTransactionHashes(block.transactionHashes);
      const index = block.transactionHashes.indexOf(transactionHash);
      delete block?._id; // this is database specific so no need to send it
      res.json({ block, transactions, index });
    } else {
      res.json({ block: null, transactions: null, index: null });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 *  /block/root/{root}:
 *    get:
 *      tags:
 *      - Block
 *      summary: Block by root.
 *      description: Returns the block and its transaction by the root.
 *      parameters:
 *        - in: path
 *          name: root
 *          required: true
 *          schema:
 *            type: string
 *            description: Transactions root.
 *      responses:
 *        200:
 *          description: Block obtained.
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  block:
 *                    type: object
 *                    example: {}
 *                  transactions:
 *                    type: array
 *                    example: []
 *        500:
 *          description: Some error ocurred.
 */
router.get('/root/:root', async (req, res, next) => {
  try {
    const { root } = req.params;
    // get data to return
    let block = await getBlockByRoot(root);
    /*
      if we don't get a block, it's possible that the corresponding 'BlockProposed'
      event is still in the event queue, so Nightfall doesn't have it in its database
      yet.  Let's wait for the current queue to empty and try again.
    */
    if (block === null) {
      logger.debug('Block not found, waiting for current queue to process before trying once more');

      await flushQueue(0);
      block = await getBlockByRoot(root);
    }

    if (block !== null) {
      const transactions = await getTransactionsByTransactionHashes(block.transactionHashes);
      delete block?._id; // this is database specific so no need to send it

      res.json({ block, transactions });
    } else {
      res.json({ block: null, transactions: null });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 *  /block/reset-localblock:
 *    get:
 *      tags:
 *      - Block
 *      summary: Reset local block.
 *      description: Route that reset a local block.
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
 *        500:
 *          description: Some error ocurred.
 */
router.get('/reset-localblock', async (req, res, next) => {
  try {
    await Block.rollback();
    await resetUnsuccessfulBlockProposedTransactions();
    res.json({ resetstatus: true });
  } catch (err) {
    next(err);
  }
});

export default router;
