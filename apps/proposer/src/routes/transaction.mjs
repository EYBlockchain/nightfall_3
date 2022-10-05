/* eslint-disable import/no-unresolved */
import express from 'express';
import { getMempool, offchainTransaction } from '../services/transaction.mjs';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const txs = getMempool();
    return res.json(txs);
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const transaction = req.body;
    await offchainTransaction(transaction);
    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
});

/**
 *
 * TODO to implement sometime in the future
 *
 */
// router.delete('/', async (req, res, next) => {});

export default router;
