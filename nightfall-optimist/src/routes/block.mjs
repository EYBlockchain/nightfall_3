/**
Routes for checking that a block is valid.
*/
import express from 'express';
import logger from '../utils/logger.mjs';
import checkBlock from '../services/check-block.mjs';
import {
  getBlockByTransactionHash,
  getBlockByRoot,
  getTransactionsByTransactionHashes,
} from '../services/database.mjs';
import { forceRollback } from '../services/block-assembler.mjs';

const router = express.Router();

router.post('/check', async (req, res, next) => {
  logger.debug('block endpoint received POST');
  try {
    const { block, transactions } = req.body;
    const result = await checkBlock(block, transactions);
    logger.debug(`Result of block check was ${JSON.stringify(result, null, 2)}`);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/root', async (req, res, next) => {
  logger.debug('block endpoint received GET');
  try {
    const { root } = req.query;
    logger.debug(`searching for block containing root ${root}`);
    const block = await getBlockByRoot(root);
    delete block._id; // this is database specific so no need to send it
    logger.debug(`Found block ${JSON.stringify(block, null, 2)} in database`);
    res.json(block || null);
  } catch (err) {
    next(err);
  }
});

router.get('/:transactionHash', async (req, res, next) => {
  logger.debug('block endpoint received get');
  try {
    const { transactionHash } = req.params;
    logger.debug(`searching for block containing transaction hash ${transactionHash}`);
    // get data to return
    const block = await getBlockByTransactionHash(transactionHash);
    if (block !== null) {
      const transactions = await getTransactionsByTransactionHashes(block.transactionHashes);
      const index = block.transactionHashes.indexOf(transactionHash);
      delete block?._id; // this is database specific so no need to send it
      logger.debug(`Found block ${JSON.stringify(block, null, 2)} in database`);
      res.json({ block, transactions, index });
    } else {
      logger.debug('Block not found');
      res.json({ block: null, transactions: null, index: null });
    }
  } catch (err) {
    next(err);
  }
});

router.post('/rollback', async (req, res, next) => {
  logger.debug('rollback endpoint received post');
  try {
    const block = req.body;
    res.json(await forceRollback(block));
  } catch (err) {
    next(err);
  }
});

export default router;
