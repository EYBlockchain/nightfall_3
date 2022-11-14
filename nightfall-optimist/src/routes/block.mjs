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
router.get('/make-now', async (req, res, next) => {
  try {
    logger.debug(`block make-now endpoint received GET`);
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
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Block
 *      summary: Block by transaction hash.
 *      description: Returns the block, its transaction and the index by transaction hash.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
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
 *                        $ref: '#/components/schemas/Block'
 *                      transactions:
 *                        type: array
 *                        items:
 *                          $ref: '#/components/schemas/Transaction'
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
 *        401:
 *          $ref: '#/components/responses/UnauthorizedError'
 *        500:
 *          description: Some error ocurred.
 */
router.get('/transaction-hash/:transactionHash', async (req, res, next) => {
  try {
    const { transactionHash } = req.params;
    logger.debug(`searching for block containing transaction hash ${transactionHash}`);
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
 *      security:
 *        - ApiKeyAuth: []
 *      tags:
 *      - Block
 *      summary: Block by root.
 *      description: Returns the block and its transaction by the root.
 *      parameters:
 *        - in: header
 *          name: api_key
 *          schema:
 *            type: string
 *            format: uuid
 *          required: true
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
 *                    $ref: '#/components/schemas/Block'
 *                  transactions:
 *                    type: array
 *                    items:
 *                      $ref: '#/components/schemas/Transaction'
 *        401:
 *          $ref: '#/components/responses/UnauthorizedError'
 *        500:
 *          description: Some error ocurred.
 */
router.get('/root/:root', async (req, res, next) => {
  try {
    const { root } = req.params;
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
