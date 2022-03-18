/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../cli/lib/nf3.mjs';
import { waitForSufficientBalance, retrieveL2Balance } from './utils.mjs';
import logger from '../common-files/utils/logger.mjs';
import { app, setNf3Instance } from './ping-pong/proposer/src/app.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { zkpMnemonic, userEthereumSigningKey, proposerEthereumSigningKey, TRANSACTIONS_PER_BLOCK } =
  config;

const {
  tokenConfigs: { tokenType, tokenId },
  transferValue,
  fee,
} = config.TEST_OPTIONS;

const TX_WAIT = 10000;
const TEST_LENGTH = 4;

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const recipientPkd = '0x1ac3b61ecba1448e697b23d37efe290fb86554b2f905aaca3a6df59805eca366';

describe('Testing ping-pong', () => {
  let nf3User;
  let nf3Proposer;
  let ercAddress;

  const PROPOSER_PORT = 8088;
  const PROPOSER_URL = 'http://host.docker.internal';
  const paymentUrl = 'https://rpc-mumbai.maticvigil.com'; // already in environment in config for localhost

  /* 
  Polygon Mumbai Testnet RPC - HTTP, WS
  --------------------------------------
  https://rpc-mumbai.matic.today or
  https://matic-mumbai.chainstacklabs.com or
  https://rpc-mumbai.maticvigil.com or
  https://matic-testnet-archive-rpc.bwarelabs.com
  wss://rpc-mumbai.matic.today or
  wss://ws-matic-mumbai.chainstacklabs.com or
  wss://rpc-mumbai.maticvigil.com/ws or
  wss://matic-testnet-archive-ws.bwarelabs.com

  Block Explorer
  ---------------
  https://mumbai.polygonscan.com/
  */

  before(async () => {
    environment.web3PaymentWsUrl = paymentUrl;
    nf3User = new Nf3(userEthereumSigningKey, environment);
    nf3Proposer = new Nf3(proposerEthereumSigningKey, environment);

    await nf3User.init(zkpMnemonic);
    if (await nf3User.healthcheck('client')) logger.info('Healthcheck passed');
    else throw new Error('Healthcheck failed');

    await nf3Proposer.init(undefined, 'optimist');
    if (await nf3Proposer.healthcheck('optimist')) logger.info('Healthcheck passed');
    else throw new Error('Healthcheck failed');
    logger.info('Attempting to register proposer');
    // let's see if the proposer has been registered before
    const { proposers } = await nf3Proposer.getProposers();
    const proposerUrl = PROPOSER_PORT !== '' ? `${PROPOSER_URL}:${PROPOSER_PORT}` : '';
    // if not, let's register them
    if (proposers.length === 0) {
      await nf3Proposer.registerProposer(proposerUrl);
      logger.info('Proposer registration complete');
    } else if (!proposers.map(p => p.thisAddress).includes(nf3Proposer.ethereumAddress)) {
      await nf3Proposer.registerProposer(proposerUrl);
      logger.info('Proposer registration complete');
    } else logger.warn('Proposer appears to be registerd already');
    if (PROPOSER_PORT !== '') {
      setNf3Instance(nf3Proposer);
      app.listen(PROPOSER_PORT);
      logger.debug(`Proposer API up at URL ${PROPOSER_URL} and port ${PROPOSER_PORT}`);
    }
    // TODO subscribe to layer 1 blocks and call change proposer
    nf3Proposer.startProposer();
    logger.info('Listening for incoming events');

    ercAddress = await nf3User.getContractAddress('ERC20Mock');
  });

  describe('Test deposits and transfers', () => {
    it('User should have the correct balance after deposits / transfers', async () => {
      let expectedIncBalance = 0;
      let expectedDecPaymentBalance = 0;
      const startBalance = await retrieveL2Balance(nf3User);
      console.log('START L2 BALANCE', startBalance);
      const startPaymentBalance = await nf3User.getPaymentBalance(nf3User.ethereumAddress);
      console.log('START L1 PAYMENT BALANCE:', startPaymentBalance);
      // Create a block of deposits
      for (let i = 0; i < TRANSACTIONS_PER_BLOCK; i++) {
        await nf3User.deposit(ercAddress, tokenType, transferValue, tokenId);
        expectedIncBalance += transferValue;
      }

      // Create a block of transfer and deposit transactions
      let offchain = false;
      for (let i = 0; i < TEST_LENGTH; i++) {
        await waitForSufficientBalance(nf3User, transferValue);
        try {
          logger.info(`Transfer is sent offchain : ${offchain}`);
          if (offchain) {
            let paymentTransactionHash;
            try {
              const paymentTx = await nf3User.sendPayment(nf3User.ethereumAddress, fee);
              paymentTransactionHash = paymentTx.transactionHash;
              expectedDecPaymentBalance += fee;
              logger.info(`Payment TransactionHash: ${paymentTransactionHash}`);
            } catch (e) {
              logger.error(e);
            }
            // '0x213a91fa26370baa8fb42ff8bcc11b57247ab8dfc3f20676a523130145dcd2b0'; // We simulate payment
            await nf3User.transfer(
              offchain,
              ercAddress,
              tokenType,
              transferValue,
              tokenId,
              recipientPkd,
              paymentTransactionHash,
            );
          } else
            await nf3User.transfer(
              offchain,
              ercAddress,
              tokenType,
              transferValue,
              tokenId,
              recipientPkd,
            );

          offchain = !offchain;
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
              recipientPkd,
            );
          }
        }
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
      console.log('END L2 BALANCE', endBalance);
      const endPaymentBalance = await nf3User.getPaymentBalance(nf3User.ethereumAddress);
      console.log('END L1 PAYMENT BALANCE:', endPaymentBalance);
      expect(expectedIncBalance).to.be.equal(endBalance - startBalance);
      expect(expectedDecPaymentBalance).to.be.lessThan(startPaymentBalance - endPaymentBalance);
    });
  });

  after(async () => {
    nf3User.close();
    nf3Proposer.close();
  });
});
