/**
This module contains the logic needed to check fee payment for the L2 transaction hash
 * @module payments.mjs
 * @author daveroga
 */

import config from 'config';
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { web3Payments, getContractAddress } from 'common-files/utils/web3.mjs';

const router = express.Router();

const { PAYMENT_CONTRACT_NAME } = config;
/**
 * Returns the current proposer
 */
router.get('/check', async (req, res, next) => {
  logger.debug(`check payment endpoint received GET ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { transactionHashL2, transactionFee } = req.query;
    const { address } = await getContractAddress(PAYMENT_CONTRACT_NAME);
    const paymentContractInstance = await web3Payments.getContractInstance(
      PAYMENT_CONTRACT_NAME,
      address,
    );
    console.log(paymentContractInstance);
    logger.debug(`check payment ${transactionHashL2}, ${transactionFee}`);
    const checkPayment = await paymentContractInstance.methods
      .checkPayment(transactionHashL2, transactionFee)
      .call();

    logger.debug('returning check payment');
    logger.silly(`check payment is ${JSON.stringify(checkPayment, null, 2)}`);
    res.json({ checkPayment });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
