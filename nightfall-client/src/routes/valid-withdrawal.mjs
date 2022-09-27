/**
Route to get if a withdraw is valid for finalising.
*/
import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { isValidWithdrawal } from '../services/valid-withdrawal.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const valid = await isValidWithdrawal(req.body);
    res.json({ valid });
  } catch (err) {
    next(err);
  }
});

export default router;
