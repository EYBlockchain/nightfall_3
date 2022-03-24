/**
This module contains the logic needed create a zkp transfer, i.e. to nullify
two input commitments and create two new output commitments to the same value.
It is agnostic to whether we are dealing with an ERC20 or ERC721 (or ERC1155).
 * @module deposit.mjs
 * @author westlad, Chaitanya-Konda, iAmMichaelConnor, will-kim
 */
import config from 'config';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import logger from 'common-files/utils/logger.mjs';

const { PAYMENT_CONTRACT_NAME } = config;

async function payment(paymentParams) {
  logger.info('Creating a payment transaction');
  // let's extract the input items
  const { proposerAddress, transactionHashL2 } = paymentParams;
  logger.info(`proposerAddress: ${proposerAddress}, transactionHashL2: ${transactionHashL2}`);
  const paymentContractInstance = await getContractInstance(PAYMENT_CONTRACT_NAME);

  const rawTransaction = await paymentContractInstance.methods
    .pay(proposerAddress, transactionHashL2)
    .encodeABI();

  return { rawTransaction };
}

export default payment;
