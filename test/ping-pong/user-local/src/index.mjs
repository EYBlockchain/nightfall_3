/**
Module that runs up as a user
*/

/* eslint-disable no-await-in-loop */

import config from 'config';
import logger from '../../../../common-files/utils/logger.mjs';
import Nf3 from '../../../../cli/lib/nf3.mjs';
import { waitForSufficientBalance, retrieveL2Balance } from './utils.mjs';

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { mnemonics, signingKeys, txPerBlock, pkds } = config.TEST_OPTIONS;

const { TEST_LENGTH, ERC20_NAME, TX_WAIT = 1000, IS_TEST_RUNNER = '' } = process.env;

/**
Does the preliminary setup and starts listening on the websocket
*/
async function localTest() {
  logger.info('Starting local test...');
  logger.debug('ENVV', environment);

  const tokenType = 'ERC20';
  const value = 1;
  const tokenId = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const nf3 = new Nf3(IS_TEST_RUNNER ? signingKeys.user1 : signingKeys.user2, environment);

  await nf3.init(IS_TEST_RUNNER ? mnemonics.user1 : mnemonics.user2);
  if (await nf3.healthcheck('client')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');

  const ercAddress = await nf3.getContractAddress(ERC20_NAME);
  const startBalance = await retrieveL2Balance(nf3);

  let offchainTx = !!IS_TEST_RUNNER;
  // Create a block of deposits
  for (let i = 0; i < txPerBlock; i++) {
    await nf3.deposit(ercAddress, tokenType, value, tokenId);
  }

  // Create a block of transfer and deposit transactions
  for (let i = 0; i < TEST_LENGTH; i++) {
    await waitForSufficientBalance(nf3, value);
    try {
      await nf3.transfer(
        offchainTx,
        ercAddress,
        tokenType,
        value,
        tokenId,
        IS_TEST_RUNNER ? pkds.user2 : pkds.user1,
      );
    } catch (err) {
      if (err.message.includes('No suitable commitments')) {
        // if we get here, it's possible that a block we are waiting for has not been proposed yet
        // let's wait 10x normal and then try again
        logger.warn(
          `No suitable commitments were found for transfer. I will wait ${
            0.01 * TX_WAIT
          } seconds and try one last time`,
        );
        await new Promise(resolve => setTimeout(resolve, 10 * TX_WAIT));
        await nf3.transfer(
          offchainTx,
          ercAddress,
          tokenType,
          value,
          tokenId,
          IS_TEST_RUNNER ? pkds.user2 : pkds.user1,
        );
      }
    }
    await nf3.deposit(ercAddress, tokenType, value, tokenId);
    await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
    console.log(`Completed ${i + 1} pings`);
    offchainTx = !offchainTx;
  }

  // Wait for sometime at the end to retrieve balance to include any transactions sent by the other use
  // This needs to be much longer than we may have waited for a transfer
  let loop = 0;
  let loopMax = 10000;
  if (IS_TEST_RUNNER) loopMax = 10; // the TEST_RUNNER must finish first so that its exit status is returned to the tester
  do {
    const endBalance = await retrieveL2Balance(nf3);
    if (endBalance - startBalance === txPerBlock * value + value * TEST_LENGTH && IS_TEST_RUNNER) {
      logger.info('Test passed');
      logger.info(
        'Balance of User (txPerBlock*value (txPerBlock*1) + value received) ',
        endBalance - startBalance,
      );
      logger.info('Amount sent to other User', value * TEST_LENGTH);
      nf3.close();
      process.exit(0);
    } else {
      logger.info(
        'The test has not yet passed because the L2 balance has not increased, or I am not the test runner - waiting',
        endBalance - startBalance,
        txPerBlock * value + value * TEST_LENGTH,
      );
      await new Promise(resolving => setTimeout(resolving, 20 * TX_WAIT)); // TODO get balance waiting working well
      loop++;
    }
  } while (loop < loopMax);
  process.exit(1);
}

localTest();
