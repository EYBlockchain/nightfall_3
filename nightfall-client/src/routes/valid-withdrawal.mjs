/**
Route to get if a withdraw is valid for finalising.
*/
import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { isValidWithdrawal } from '../services/valid-withdrawal.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug(`valid-withdrawal endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const valid = await isValidWithdrawal(req.body);
    logger.debug(`returning valid ${valid}`);
    res.json({ valid });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
