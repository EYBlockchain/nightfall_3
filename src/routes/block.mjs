/**
Routes for checking that a block is valid.
*/
import express from 'express';
import logger from '../utils/logger.mjs';
import checkBlock from '../services/check-block.mjs';
import { getBlock } from '../services/database.mjs';

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

router.get('/:transactionHash', async (req, res, next) => {
  logger.debug('block endpoint received get');
  try {
    const { transactionHash } = req.params;
    logger.debug(`searching for block containing transaction hash ${transactionHash}`);
    const block = await getBlock(transactionHash);
    logger.debug(`Found block ${JSON.stringify(block, null, 2)} in database`);
    res.json(block || null);
  } catch (err) {
    next(err);
  }
});

export default router;
