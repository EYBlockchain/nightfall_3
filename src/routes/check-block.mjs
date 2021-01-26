/**
Routes for checking that a block is valid.
*/
import express from 'express';
import logger from '../utils/logger.mjs';
import checkBlock from '../services/check-block.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug('check-block endpoint received POST');
  try {
    const { block, transactions } = req.body;
    const result = await checkBlock(block, transactions);
    logger.debug(`Result of block check was ${JSON.stringify(result, null, 2)}`);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
