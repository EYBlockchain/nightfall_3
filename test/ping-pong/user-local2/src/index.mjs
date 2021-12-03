/**
Module that runs up as a user
*/

/* eslint-disable no-await-in-loop */
/* eslint no-constant-condition: ["error", { "checkLoops": false } ] */

// import logger from 'common-files/utils/logger.mjs';
import config from 'config';
import Nf3 from '../../../../cli/lib/nf3.mjs';
import { waitForSufficientBalance, retrieveL2Balance } from './utils.mjs';

const {
  zkpMnemonic,
  user2EthereumSigningKey,
  optimistWsUrl,
  web3WsUrl,
  clientBaseUrl,
  optimistBaseUrl,
  TRANSACTIONS_PER_BLOCK,
} = config;

const TEST_LENGTH = 1;
const recipientPkd = process.env.RECIPIENT_PKD.split(',');

/**
Does the preliminary setup and starts listening on the websocket
*/
async function localTest() {
  // logger.info('Starting local test...');
  console.log('Starting local test...');

  const tokenType = 'ERC20';
  const value = 1;
  const tokenId = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const nf3 = new Nf3(
    clientBaseUrl,
    optimistBaseUrl,
    optimistWsUrl,
    web3WsUrl,
    user2EthereumSigningKey,
  );

  await nf3.init(zkpMnemonic);
  if (await nf3.healthcheck('client')) console.log('Healthcheck passed');
  else throw new Error('Healthcheck failed');

  const ercAddress = await nf3.getContractAddress('ERC20Mock2');
  const startBalance = await retrieveL2Balance(nf3);

  console.log('HERE startBalance', startBalance);

  // To start with create a block of deposits such that, we do a transfer in the next block
  for (let i = 0; i < TRANSACTIONS_PER_BLOCK; i++) {
    await nf3.deposit(ercAddress, tokenType, value, tokenId);
  }

  for (let i = 0; i < TEST_LENGTH; i++) {
    await waitForSufficientBalance(nf3, value);
    await nf3.transfer(false, ercAddress, tokenType, value, tokenId, recipientPkd);
    await nf3.deposit(ercAddress, tokenType, value, tokenId);
    await new Promise(resolve => setTimeout(resolve, 20000));
  }

  const endBalance = await retrieveL2Balance(nf3);
  console.log('HERE endBalance', endBalance);

  if (endBalance - startBalance === 2 * value) {
    console.log('Test passed');
    nf3.close();
  } else {
    console.log('The test failed because the L2 balance has not increased');
    process.exit(1);
  }
}

localTest();
