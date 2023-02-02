/**
 * Routes for interacting with client transactions data.
 */
import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { getTransactionByTransactionHash } from '../services/database.mjs';
import { findTransactionInMempools, setL2TransactionStatus } from '../services/transaction.mjs';

const router = express.Router();

/**
 * The endpoint returns the blockNumberL2 for the specified transaction
 * If blockNumberL2 => 0, the transaction was 'mined'
 * If blockNumberL2 === -1, the transaction is in the 'mempool'
 * Errors: 404 if not found, 400 if result is not valid
 */
router.get('/status/:l2TransactionHash', async (req, res, next) => {
  const { l2TransactionHash } = req.params;

  try {
    let transaction = await getTransactionByTransactionHash(l2TransactionHash);
    if (transaction === null) {
      logger.debug('Transaction not in Client, check mempools..');
      transaction = await findTransactionInMempools(l2TransactionHash);
    }
    logger.debug({ msg: 'Transaction found', transaction });
    const status = setL2TransactionStatus(transaction);
    res.json(status);
  } catch (err) {
    res.json({ error: err.message });
    next(err);
  }
});

export default router;
