/**
This module contains the logic needed to create fee payment for the proposer
 * @module payments.mjs
 * @author daveroga
 */
import config from 'config';
import { getContractInstance } from 'common-files/utils/contract-payments.mjs';
import logger from 'common-files/utils/logger.mjs';

const { PAYMENT_CONTRACT_NAME } = config;

async function payment(paymentParams) {
  logger.info('Creating a payment transaction');
  // let's extract the input items
  const { transactionHashL2 } = paymentParams;
  logger.info(`transactionHashL2: ${transactionHashL2}`);
  const paymentContractInstance = await getContractInstance(PAYMENT_CONTRACT_NAME);

  const rawTransaction = await paymentContractInstance.methods.pay(transactionHashL2).encodeABI();

  return { rawTransaction };
}

export default payment;
