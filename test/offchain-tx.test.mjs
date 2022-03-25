/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../cli/lib/nf3.mjs';
import { waitForSufficientBalance, retrieveL2Balance } from './utils.mjs';
import logger from '../common-files/utils/logger.mjs';
import app from '../cli/src/proposer/app.mjs';
import {
  nf3Init,
  nf3Healthcheck,
  nf3RegisterProposer,
  nf3StartProposer,
  nf3Close,
  nf3GetEthereumAddress,
} from '../cli/src/proposer/nf3-wrapper.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

// eslint-disable-next-line prettier/prettier
const { TRANSACTIONS_PER_BLOCK, PROPOSER_PORT } =
  config;

const {
  tokenConfigs: { tokenType, tokenId },
  transferValue,
  fee,
  pkds,
  signingKeys,
  mnemonics,
} = config.TEST_OPTIONS;

const TX_WAIT = 10000;
const TEST_LENGTH = 2;

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

describe('Testing off-chain transactions', () => {
  let nf3User;
  let ercAddress;

  before(async () => {
    nf3User = new Nf3(signingKeys.user1, environment);

    await nf3User.init(mnemonics.user1);
    if (await nf3User.healthcheck('client')) logger.info('Healthcheck client passed');
    else throw new Error('Healthcheck failed');

    await nf3Init(signingKeys.proposer1, environment, undefined, 'optimist');
    if (await nf3Healthcheck('optimist')) logger.info('Healthcheck optimist passed');
    else throw new Error('Healthcheck failed');
    logger.info('Attempting to register proposer');

    await nf3RegisterProposer(environment.proposerBaseUrl);
    if (PROPOSER_PORT !== '') {
      logger.debug('Proposer healthcheck up');
      app.listen(PROPOSER_PORT);
    }

    nf3StartProposer();
    logger.info('Listening for incoming events');

    ercAddress = await nf3User.getContractAddress('ERC20Mock');
  });

  describe('Test off-chain transfers / withdraws', () => {
    it('User should have the correct balance after deposits / off-chain transfers', async () => {
      let expectedIncBalance = 0;
      let expectedDecPaymentBalance = 0;
      const startBalance = await retrieveL2Balance(nf3User);
      const startPaymentBalance = BigInt(await nf3User.getPaymentBalance(nf3User.ethereumAddress));
      const proposerAddress = nf3GetEthereumAddress(); // It's the only proposer
      const proposerStartPaymentBalance = BigInt(await nf3User.getPaymentBalance(proposerAddress));
      // Create a block of deposits
      for (let i = 0; i < TRANSACTIONS_PER_BLOCK; i++) {
        await nf3User.deposit(ercAddress, tokenType, transferValue, tokenId);
        expectedIncBalance += transferValue;
      }

      // Create a block of transfer and deposit transactions
      const offchain = true;
      for (let i = 0; i < TEST_LENGTH; i++) {
        await waitForSufficientBalance(nf3User, transferValue);
        try {
          logger.info(`Transfer is sent offchain : ${offchain}`);
          await nf3User.transfer(
            offchain,
            ercAddress,
            tokenType,
            transferValue,
            tokenId,
            pkds.user1,
            fee,
          );
          if (offchain) expectedDecPaymentBalance += fee;
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
            await nf3User.transfer(
              false,
              ercAddress,
              tokenType,
              transferValue,
              tokenId,
              pkds.user1,
              fee,
            );
          }
        }

        // offchain = !offchain;

        expectedIncBalance -= transferValue;
        await nf3User.deposit(ercAddress, tokenType, transferValue, tokenId);
        expectedIncBalance += transferValue;
        await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
        console.log(`Completed ${i + 1} pings`);
      }

      // Wait for sometime at the end to retrieve balance to include any pending transactions
      let loop = 0;
      const loopMax = 10;
      do {
        const endBalance = await retrieveL2Balance(nf3User);
        if (endBalance - startBalance !== expectedIncBalance) {
          logger.info(
            'The test has not yet passed because the L2 balance has not increased',
            endBalance - startBalance,
            expectedIncBalance,
          );
          await new Promise(resolving => setTimeout(resolving, TX_WAIT)); // TODO get balance waiting working well
          loop++;
        } else break;
      } while (loop < loopMax);

      const endBalance = await retrieveL2Balance(nf3User);
      const endPaymentBalance = BigInt(await nf3User.getPaymentBalance(nf3User.ethereumAddress));
      const proposerEndPaymentBalance = BigInt(await nf3User.getPaymentBalance(proposerAddress));
      expect(expectedIncBalance).to.be.equal(endBalance - startBalance);
      expect(expectedDecPaymentBalance).to.be.lessThan(
        Number(startPaymentBalance - endPaymentBalance),
      );
      expect(expectedDecPaymentBalance).to.be.equal(
        Number(proposerEndPaymentBalance - proposerStartPaymentBalance),
      );
    });

    it('User should have the correct balance after off-chain withdraw', async () => {
      // let expectedIncBalance = 0;
      let expectedDecPaymentBalance = 0;
      // const startBalance = await retrieveL2Balance(nf3User);
      const startPaymentBalance = BigInt(await nf3User.getPaymentBalance(nf3User.ethereumAddress));
      const proposerAddress = nf3GetEthereumAddress(); // It's the only proposer
      const proposerStartPaymentBalance = BigInt(await nf3User.getPaymentBalance(proposerAddress));
      // console.log('START: ', startBalance, startPaymentBalance, proposerStartPaymentBalance);
      await nf3User.withdraw(true, ercAddress, tokenType, transferValue, tokenId, pkds.user1, fee);
      expectedDecPaymentBalance += fee;
      // expectedIncBalance -= transferValue;
      // const endBalance = await retrieveL2Balance(nf3User);
      const endPaymentBalance = BigInt(await nf3User.getPaymentBalance(nf3User.ethereumAddress));
      const proposerEndPaymentBalance = BigInt(await nf3User.getPaymentBalance(proposerAddress));
      // console.log('END: ', endBalance, endPaymentBalance, proposerEndPaymentBalance);
      // expect(expectedIncBalance).to.be.equal(startBalance - endBalance);
      expect(expectedDecPaymentBalance).to.be.lessThan(
        Number(startPaymentBalance - endPaymentBalance),
      );
      expect(expectedDecPaymentBalance).to.be.equal(
        Number(proposerEndPaymentBalance - proposerStartPaymentBalance),
      );
    });
  });

  after(async () => {
    nf3User.close();
    nf3Close();
  });
});
