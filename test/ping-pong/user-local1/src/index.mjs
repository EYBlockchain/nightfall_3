/**
Module that runs up as a user
*/

/* eslint-disable no-await-in-loop */
/* eslint no-constant-condition: ["error", { "checkLoops": false } ] */

import logger from 'common-files/utils/logger.mjs';
import config from 'config';
import inquirer from 'inquirer';
import Nf3 from '../../../../cli/lib/nf3.mjs';
import waitForSufficientBalance from './utils.mjs';

const {
  zkpMnemonic,
  userEthereumSigningKey,
  optimistWsUrl,
  web3WsUrl,
  clientBaseUrl,
  optimistBaseUrl,
  TRANSACTIONS_PER_BLOCK,
} = config;

/**
Asks CLI questions
*/
async function promptUser() {
  return new Promise(resolve => {
    setTimeout(function () {
      resolve(true);
    }, 10000);
    resolve(
      inquirer.prompt([
        {
          name: 'isContinue',
          type: 'confirm',
          message: 'Continue the test',
          default: true,
        },
      ]),
    );
  });
}

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

  const ercAddress = await nf3.getContractAddress('ERC20Mock'); // TODO use proper mock contracts
  const startBalance = await nf3.getLayer2Balances();

  console.log('HERE startBalance', startBalance);

  // To start with create a block of deposits such that, we do a transfer in the next block
  for (let i = 0; i < TRANSACTIONS_PER_BLOCK; i++) {
    await nf3.deposit(ercAddress, tokenType, value, tokenId);
  }

  while (true) {
    const { isContinue } = await promptUser();
    if (isContinue) {
      for (let j = 0; j < TRANSACTIONS_PER_BLOCK; j++) {
        // ensure there is sufficient balance for transfer.
        // this function relies on a prior deposit of
        // similar value being made
        await waitForSufficientBalance(nf3, value);
        await nf3.transfer(false, ercAddress, tokenType, value, tokenId, nf3.zkpKeys.pkd);
        await new Promise(resolve => setTimeout(resolve, 20000));
      }
    } else break;
  }

  const endBalance = await nf3.getLayer2Balances();
  console.log('HERE endBalance', endBalance);

  if (Object.keys(startBalance).length >= Object.keys(endBalance).length) {
    logger.warn('The test failed because the L2 balance has not increased');
    process.exit(1);
  }
  logger.info('Test passed');
  nf3.close();
}

localTest();
