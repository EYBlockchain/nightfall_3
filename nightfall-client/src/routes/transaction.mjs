/**
 * Routes for interacting with client transactions data.
 */
import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { getTransactionByTransactionHash } from '../services/database.mjs';
import { findTransactionInMempools, setL2TransactionStatus } from '../services/transaction.mjs';

const router = express.Router();

/**
 * A successful request will return `blockNumberL2` and `status` for the specified transaction (tx)
 * If blockNumberL2 => 0, the transaction was 'mined'
 * If blockNumberL2 === -1, the transaction is in the 'mempool'
 * Errors: 404 tx not found, 400 tx found not valid
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

    const { blockNumberL2 } = transaction;
    res.json({ status, blockNumberL2 });
  } catch (err) {
    next(err);
  }
});

export default router;
