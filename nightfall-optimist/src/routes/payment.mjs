/**
This module contains the logic needed to check fee payment for the L2 transaction hash
 * @module payments.mjs
 * @author daveroga
 */

import config from 'config';
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { getContractInstance } from 'common-files/utils/contract-payments.mjs';

const router = express.Router();

const { PAYMENT_CONTRACT_NAME } = config;
/**
 * Returns the current proposer
 */
router.get('/check', async (req, res, next) => {
  logger.debug(`check payment endpoint received GET ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { transactionHashL2, transactionFee } = req.query;
    console.log('111111', transactionHashL2, transactionFee);
    const paymentContractInstance = await getContractInstance(PAYMENT_CONTRACT_NAME);

    const checkPayment = await paymentContractInstance.methods
      .checkPayment(transactionHashL2, transactionFee)
      .call();
    console.log('33333');

    logger.debug('returning check payment');
    logger.silly(`check payment is ${JSON.stringify(checkPayment, null, 2)}`);
    res.json({ checkPayment });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
