/**
Module that runs up as a user
*/

/* eslint-disable no-await-in-loop */

import logger from 'common-files/utils/logger.mjs';
import config from 'config';
import Nf3 from '../../../../cli/lib/nf3.mjs';
import { waitForSufficientBalance, retrieveL2Balance } from './utils.mjs';

const {
  zkpMnemonic,
  userEthereumSigningKey,
  optimistWsUrl,
  web3WsUrl,
  clientBaseUrl,
  optimistBaseUrl,
  TRANSACTIONS_PER_BLOCK,
} = config;

const { TEST_LENGTH, ERC20_NAME } = process.env;
const recipientPkd = process.env.RECIPIENT_PKD.split(',');

/**
Does the preliminary setup and starts listening on the websocket
*/
async function localTest() {
  logger.info('Starting local test...');

  const tokenType = 'ERC20';
  const value = 1;
  const tokenId = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const nf3 = new Nf3(
    clientBaseUrl,
    optimistBaseUrl,
    optimistWsUrl,
    web3WsUrl,
    userEthereumSigningKey,
  );

  await nf3.init(zkpMnemonic);
  if (await nf3.healthcheck('client')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');

  const ercAddress = await nf3.getContractAddress(ERC20_NAME);
  const startBalance = await retrieveL2Balance(nf3);

  // Create a block of deposits
  for (let i = 0; i < TRANSACTIONS_PER_BLOCK; i++) {
    await nf3.deposit(ercAddress, tokenType, value, tokenId);
  }

  // Create a block of transfer and deposit transactions
  for (let i = 0; i < TEST_LENGTH; i++) {
    await waitForSufficientBalance(nf3, value);
    await nf3.transfer(false, ercAddress, tokenType, value, tokenId, recipientPkd);
    await nf3.deposit(ercAddress, tokenType, value, tokenId);
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  // Wait for sometime at the end to retrieve balance to include any transactions sent by the other use
  await new Promise(resolving => setTimeout(resolving, 200000));
  const endBalance = await retrieveL2Balance(nf3);

  if (endBalance - startBalance === 2 * value + value * TEST_LENGTH) {
    logger.info('Test passed');
    logger.info('Balance of User (2*value (2*1) + value received) ', endBalance - startBalance);
    logger.info('Amount sent to other User', value * TEST_LENGTH);
    nf3.close();
  } else {
    logger.info('The test failed because the L2 balance has not increased');
    process.exit(1);
  }
}

localTest();
