/* This adversary test relies on the bad block and bad tranasction types as defined in
 * test/adversary/adversary-code/database.mjs and test/adversary/adversary-code/block.mjs
 * files. Later this test will work against random selection of bad block and bad
 * tranasction types
 */

/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../cli/lib/nf3.mjs';
import {
  waitForSufficientBalance,
  registerProposerOnNoProposer,
  retrieveL2Balance,
  // eslint-disable-next-line no-unused-vars
  waitForNoPendingCommitments,
} from './utils.mjs';
import logger from '../common-files/utils/logger.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { TRANSACTIONS_PER_BLOCK } = config;
const TX_WAIT = 12000;
// these variables allow to enable/disable different tests. First approach is to just enable
// single transfer. But passing different ENVs, we can enable the rest of the tests
const TEST_LENGTH_TRANSFER = process.env.TEST_LENGTH_TRANSFER || 4;
const TEST_LENGTH_DOUBLE_TRANSFER = process.env.TEST_LENGTH_DOUBLE_TRANSFER || 0;
const TEST_LENGTH_WITHDRAW = process.env.TEST_LENGTH_WITHDRAW || 0;

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

describe('Testing with an adversary', () => {
  let nf3User;
  let nf3AdversarialProposer;
  let ercAddress;
  let nf3Challenger;
  let startL2Balance;
  let expectedL2Balance = 0;
  let intervalId;

  // this is the etherum private key for accounts[0] and so on
  const ethereumSigningKeyUser =
    '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const ethereumSigningKeyProposer =
    '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d';
  const ethereumSigningKeyChallenger =
    '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb';
  const mnemonicUser =
    'trip differ bamboo bundle bonus luxury strike mad merry muffin nose auction';
  const mnemonicProposer =
    'high return hold whale promote payment hat panel reduce oyster ramp mouse';
  const mnemonicChallenger =
    'heart bless cream into jacket purpose very sentence saddle sea bird abuse';
  const tokenId = '0x00'; // has to be zero for ERC20
  const tokenType = 'ERC20'; // it can be 'ERC721' or 'ERC1155'
  // const value = 10;
  const value = 5;
  const value2 = 1000;

  let challengerInitialEarnings = 0;
  let challengerFinalEarnings = 0;

  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;

  before(async () => {
    console.log(`TRANSACTIONS_PER_BLOCK: ${TRANSACTIONS_PER_BLOCK}`);
    console.log('ENV:\n', environment);
    nf3User = new Nf3(ethereumSigningKeyUser, environment);

    const {
      optimistApiUrl,
      optimistWsUrl,
      adversarialOptimistApiUrl,
      adversarialOptimistWsUrl,
      ...others
    } = environment;
    nf3AdversarialProposer = new Nf3(ethereumSigningKeyProposer, {
      ...others,
      optimistApiUrl: adversarialOptimistApiUrl,
      optimistWsUrl: adversarialOptimistWsUrl,
    });

    nf3Challenger = new Nf3(ethereumSigningKeyChallenger, {
      ...others,
      optimistApiUrl: adversarialOptimistApiUrl,
      optimistWsUrl: adversarialOptimistWsUrl,
    });

    // Generate a random mnemonic (uses crypto.randomBytes under the hood), defaults to 128-bits of entropy
    await nf3User.init(mnemonicUser);
    await nf3AdversarialProposer.init(mnemonicProposer);
    await nf3Challenger.init(mnemonicChallenger);

    if (!(await nf3User.healthcheck('optimist'))) throw new Error('Healthcheck failed');
    if (!(await nf3AdversarialProposer.healthcheck('optimist')))
      throw new Error('Healthcheck failed');
    if (!(await nf3Challenger.healthcheck('optimist'))) throw new Error('Healthcheck failed');

    // Proposer registration
    await nf3AdversarialProposer.registerProposer();
    // Proposer listening for incoming events
    const blockProposeEmitter = await nf3AdversarialProposer.startProposer();
    blockProposeEmitter
      .on('receipt', (receipt, block) => {
        logger.debug(
          `L2 Block with L2 block number ${block.blockNumberL2} was proposed. The L1 transaction hash is ${receipt.transactionHash}`,
        );
      })
      .on('error', (error, block) => {
        logger.error(
          `Proposing L2 Block with L2 block number ${block.blockNumberL2} failed due to error: ${error} `,
        );
      });
    ercAddress = await nf3User.getContractAddress('ERC20Mock');

    // Challenger registration
    await nf3Challenger.registerChallenger();
    // Chalenger listening for incoming events
    nf3Challenger.startChallenger();

    const challengerEmitter = await nf3Challenger.getChallengeEmitter();
    challengerEmitter.on('data', txDataToSign => {
      logger.debug(`Challenger emitter with data ${txDataToSign}`);
    });
    // Because rollbacks removes the only registered proposer,
    // the proposer is registered again after each remova
    intervalId = setInterval(() => {
      registerProposerOnNoProposer(nf3AdversarialProposer);
    }, 5000);

    // Optimist keeps generating blocks after a challenge
    await chai
      .request(environment.adversarialOptimistApiUrl)
      .post('/block/stop-queue')
      .send({ nonStopFlag: 'true' });
  });

  describe('User creates deposit, single and double transfers and withdraw transactions with adversary + challenger', () => {
    it('User should have the correct balance after a series of rollbacks', async () => {
      if (TEST_LENGTH_TRANSFER === 0) return;
      // Configure adversary bad block sequence
      if (process.env.CHALLENGE_TYPE !== '') {
        logger.debug(`Configuring Challenge Type ${process.env.CHALLENGE_TYPE}`);
        await chai
          .request(environment.adversarialOptimistApiUrl)
          .post('/block/gen-block')
          .send({ blockType: ['ValidBlock', 'ValidBlock', process.env.CHALLENGE_TYPE] });
      } else {
        logger.debug(`Configuring Default Challenge Type`);
        await chai
          .request(environment.adversarialOptimistApiUrl)
          .post('/block/gen-block')
          .send({ blockType: 'reset' });
      }

      console.log('Pausing challenger queue...');
      // we pause the challenger queue and don't process challenger until unpauseQueueChallenger
      nf3Challenger.pauseQueueChallenger();
      let nDeposits = 0;
      let nTransfers = 0;

      // retrieve initial balance
      startL2Balance = await retrieveL2Balance(nf3User);

      challengerInitialEarnings = Number((await nf3Challenger.checkChallengerEarnings()).amount);

      // we are creating a block of deposits with high values such that there is
      // enough balance for a lot of transfers with low value.
      console.log('Starting balance :', startL2Balance);
      expectedL2Balance = startL2Balance;
      for (let j = 0; j < TRANSACTIONS_PER_BLOCK; j++) {
        await nf3User.deposit(ercAddress, tokenType, value, tokenId, fee);
        nDeposits++;
        expectedL2Balance += value;
      }

      for (let i = 0; i < TEST_LENGTH_TRANSFER; i++) {
        await waitForSufficientBalance(nf3User, value);
        try {
          await nf3User.transfer(
            false,
            ercAddress,
            tokenType,
            value,
            tokenId,
            nf3User.zkpKeys.compressedZkpPublicKey,
          );
          nTransfers++;
        } catch (err) {
          if (err.message.includes('No suitable commitments')) {
            // if we get here, it's possible that a block we are waiting for has not been proposed yet
            // let's wait 10x normal and then try again
            console.log(
              `No suitable commitments were found for transfer. I will wait ${
                0.01 * TX_WAIT
              } seconds and try one last time`,
            );
            await new Promise(resolve => setTimeout(resolve, 10 * TX_WAIT));
            await nf3User.transfer(
              false,
              ercAddress,
              tokenType,
              value,
              tokenId,
              nf3User.zkpKeys.compressedZkpPublicKey,
            );
            nTransfers++;
          }
        }
        for (let k = 0; k < TRANSACTIONS_PER_BLOCK - 1; k++) {
          await nf3User.deposit(ercAddress, tokenType, value, tokenId);
          nDeposits++;
          expectedL2Balance += value;
        }
        await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
        console.log(`Completed ${i + 1} pings`);
      }

      await new Promise(resolve => setTimeout(resolve, 20 * TX_WAIT));
      logger.debug(`N deposits: ${nDeposits} - N Transfers: ${nTransfers}`);

      console.log('Unpausing challenger queue...');
      // Challenger unpause
      await nf3Challenger.unpauseQueueChallenger();
      // waiting sometime to ensure that all the good transactions from bad
      // blocks were proposed in other good blocks
      console.log('Waiting for rollbacks...');

      await new Promise(resolve => setTimeout(resolve, 30 * TX_WAIT));
      await waitForSufficientBalance(nf3User, expectedL2Balance);
      const endL2Balance = await retrieveL2Balance(nf3User);
      console.log(`Completed startL2Balance`, startL2Balance);
      console.log(`Completed endL2Balance`, endL2Balance);
      challengerFinalEarnings = Number((await nf3Challenger.checkChallengerEarnings()).amount);
      console.log(`Challenger Initial Earnings`, challengerInitialEarnings);
      console.log(`Challenger Final Earnings`, challengerFinalEarnings);
      expect(expectedL2Balance).to.be.equal(endL2Balance);
      expect(challengerFinalEarnings).to.be.greaterThan(challengerInitialEarnings);
    });

    it('User should have the correct balance after a series of rollbacks with double transfers', async () => {
      // Configure adversary bad block sequence
      if (TEST_LENGTH_DOUBLE_TRANSFER === 0) return;
      if (process.env.CHALLENGE_TYPE !== '') {
        logger.debug(`Configuring Challenge Type ${process.env.CHALLENGE_TYPE}`);
        await chai
          .request(environment.adversarialOptimistApiUrl)
          .post('/block/gen-block')
          .send({ blockType: ['ValidBlock', 'ValidBlock', process.env.CHALLENGE_TYPE] });
      } else {
        logger.debug(`Configuring Default Challenge Type`);
        await chai
          .request(environment.adversarialOptimistApiUrl)
          .post('/block/gen-block')
          .send({ blockType: 'reset' });
      }
      challengerInitialEarnings = Number((await nf3Challenger.checkChallengerEarnings()).amount);

      console.log('Pausing challenger queue...');
      // we pause the challenger queue and don't process challenger until unpauseQueueChallenger
      nf3Challenger.pauseQueueChallenger();
      let nDeposits = 0;
      let nDoubleTransfers = 0;
      // retrieve initial balance
      startL2Balance = await retrieveL2Balance(nf3User);

      // we are creating a block of deposits with high values such that there is
      // enough balance for a lot of transfers with low value.
      console.log('Starting balance :', startL2Balance);
      expectedL2Balance = startL2Balance;
      for (let j = 0; j < TRANSACTIONS_PER_BLOCK; j++) {
        await nf3User.deposit(ercAddress, tokenType, value2, tokenId, fee);
        nDeposits++;
        expectedL2Balance += value2;
      }

      // We do double transfers + deposit in one round, and just deposits in the other
      let depositEn = false;
      // a random fraction for double transfer ensures we always use a double transfer
      let doubleTransferValue;
      for (let i = 0; i < TEST_LENGTH_DOUBLE_TRANSFER; i++) {
        doubleTransferValue = Math.floor(Math.random() * 2 * value2) + 1;

        await waitForSufficientBalance(nf3User, value2 * 2);
        if (depositEn) {
          console.log(`Deposit of ${value2}`);
          await nf3User.deposit(ercAddress, tokenType, value2, tokenId, fee);
          expectedL2Balance += value2;
          nDeposits++;
        } else {
          try {
            console.log(`Double Transfer of ${doubleTransferValue}`);
            await nf3User.transfer(
              false,
              ercAddress,
              tokenType,
              doubleTransferValue,
              tokenId,
              nf3User.zkpKeys.compressedZkpPublicKey,
            );
            nDoubleTransfers++;
          } catch (err) {
            if (err.message.includes('No suitable commitments')) {
              // if we get here, it's possible that a block we are waiting for has not been proposed yet
              // let's wait 10x normal and then try again
              console.log(
                `No suitable commitments were found for transfer. I will wait ${
                  0.01 * TX_WAIT
                } seconds and try one last time`,
              );
              await new Promise(resolve => setTimeout(resolve, 10 * TX_WAIT));
              await nf3User.transfer(
                false,
                ercAddress,
                tokenType,
                doubleTransferValue,
                tokenId,
                nf3User.zkpKeys.compressedZkpPublicKey,
              );
              nDoubleTransfers++;
            }
          }
        }
        depositEn = !depositEn;
        for (let k = 0; k < TRANSACTIONS_PER_BLOCK - 1; k++) {
          await nf3User.deposit(ercAddress, tokenType, value2, tokenId);
          nDeposits++;
          expectedL2Balance += value2;
        }
        await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
        console.log(`Completed ${i + 1} pings`);
      }

      await new Promise(resolve => setTimeout(resolve, 20 * TX_WAIT));
      logger.debug(`N deposits: ${nDeposits} - N Double Transfers: ${nDoubleTransfers}`);

      console.log('Unpausing challenger queue...');
      // Challenger unpause
      await nf3Challenger.unpauseQueueChallenger();
      // waiting sometime to ensure that all the good transactions from bad
      // blocks were proposed in other good blocks
      console.log('Waiting for rollbacks...');

      await new Promise(resolve => setTimeout(resolve, 30 * TX_WAIT));
      await waitForSufficientBalance(nf3User, expectedL2Balance);
      const endL2Balance = await retrieveL2Balance(nf3User);
      console.log(`Completed startL2Balance`, startL2Balance);
      console.log(`Completed endL2Balance`, endL2Balance);
      challengerFinalEarnings = Number((await nf3Challenger.checkChallengerEarnings()).amount);
      console.log(`Challenger Initial Earnings`, challengerInitialEarnings);
      console.log(`Challenger Final Earnings`, challengerFinalEarnings);
      expect(expectedL2Balance).to.be.equal(endL2Balance);
      expect(challengerFinalEarnings).to.be.greaterThan(challengerInitialEarnings);
    });

    it('User should have the correct balance after a series of rollbacks with withdraws', async () => {
      if (TEST_LENGTH_WITHDRAW === 0) return;
      // Configure adversary bad block sequence
      if (process.env.CHALLENGE_TYPE !== '') {
        logger.debug(`Configuring Challenge Type ${process.env.CHALLENGE_TYPE}`);
        await chai
          .request(environment.adversarialOptimistApiUrl)
          .post('/block/gen-block')
          .send({ blockType: ['ValidBlock', 'ValidBlock', process.env.CHALLENGE_TYPE] });
      } else {
        logger.debug(`Configuring Default Challenge Type`);
        await chai
          .request(environment.adversarialOptimistApiUrl)
          .post('/block/gen-block')
          .send({ blockType: 'reset' });
      }

      challengerInitialEarnings = Number((await nf3Challenger.checkChallengerEarnings()).amount);
      console.log('Pausing challenger queue...');
      // we pause the challenger queue and don't process challenger until unpauseQueueChallenger
      nf3Challenger.pauseQueueChallenger();
      let nDeposits = 0;
      let nWithdraws = 0;
      // retrieve initial balance
      startL2Balance = await retrieveL2Balance(nf3User);

      // we are creating a block of deposits with high values such that there is
      // enough balance for a lot of transfers with low value.
      console.log('Starting balance :', startL2Balance);
      expectedL2Balance = startL2Balance;
      for (let j = 0; j < TRANSACTIONS_PER_BLOCK; j++) {
        await nf3User.deposit(ercAddress, tokenType, value, tokenId, fee);
        nDeposits++;
        expectedL2Balance += value;
      }

      for (let i = 0; i < TEST_LENGTH_WITHDRAW; i++) {
        await waitForSufficientBalance(nf3User, value);
        try {
          console.log(`Withdraw ${value}`);
          await nf3User.withdraw(
            false,
            ercAddress,
            tokenType,
            value,
            tokenId,
            nf3User.ethereumAddress,
          );
          nWithdraws++;
          expectedL2Balance -= value;
        } catch (err) {
          if (err.message.includes('No suitable commitments')) {
            // if we get here, it's possible that a block we are waiting for has not been proposed yet
            // let's wait 10x normal and then try again
            console.log(
              `No suitable commitments were found for transfer. I will wait ${
                0.01 * TX_WAIT
              } seconds and try one last time`,
            );
            await new Promise(resolve => setTimeout(resolve, 10 * TX_WAIT));
            await nf3User.withdraw(
              false,
              ercAddress,
              tokenType,
              value,
              tokenId,
              nf3User.ethereumAddress,
            );
            nWithdraws++;
            expectedL2Balance -= value;
          }
        }
        for (let k = 0; k < TRANSACTIONS_PER_BLOCK - 1; k++) {
          await nf3User.deposit(ercAddress, tokenType, value, tokenId);
          nDeposits++;
          expectedL2Balance += value;
        }
        await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
        console.log(`Completed ${i + 1} pings`);
      }

      await new Promise(resolve => setTimeout(resolve, 20 * TX_WAIT));
      logger.debug(`N deposits: ${nDeposits} - N Withdraws: ${nWithdraws}`);

      console.log('Unpausing challenger queue...');
      // Challenger unpause
      await nf3Challenger.unpauseQueueChallenger();
      // waiting sometime to ensure that all the good transactions from bad
      // blocks were proposed in other good blocks
      console.log('Waiting for rollbacks...');

      await new Promise(resolve => setTimeout(resolve, 30 * TX_WAIT));
      await waitForSufficientBalance(nf3User, expectedL2Balance);
      const endL2Balance = await retrieveL2Balance(nf3User);
      console.log(`Completed startL2Balance`, startL2Balance);
      console.log(`Completed endL2Balance`, endL2Balance);
      challengerFinalEarnings = Number((await nf3Challenger.checkChallengerEarnings()).amount);
      console.log(`Challenger Initial Earnings`, challengerInitialEarnings);
      console.log(`Challenger Final Earnings`, challengerFinalEarnings);
      expect(expectedL2Balance).to.be.equal(endL2Balance);
      expect(challengerFinalEarnings).to.be.greaterThan(challengerInitialEarnings);
    });

    it('Challenger withdraws earnings', async () => {
      if (
        TEST_LENGTH_WITHDRAW === 0 &&
        TEST_LENGTH_DOUBLE_TRANSFER === 0 &&
        TEST_LENGTH_TRANSFER === 0
      )
        return;
      challengerInitialEarnings = Number((await nf3Challenger.checkChallengerEarnings()).amount);
      // withdraw challenger earnings
      await nf3Challenger.withdrawChallengerEarnings();
      challengerFinalEarnings = Number((await nf3Challenger.checkChallengerEarnings()).amount);
      console.log(`Challenger Initial Earnings`, challengerInitialEarnings);
      console.log(`Challenger Final Earnings`, challengerFinalEarnings);
      expect(challengerInitialEarnings).to.be.greaterThan(0);
      expect(challengerFinalEarnings).to.be.equal(0);
    });
  });

  describe('User creates deposit, transfer with adversary + deregistered challenger', () => {
    it('User shouldnt have the correct balance because of incorrect unchallenged blocks', async () => {
      if (TEST_LENGTH_TRANSFER === 0) return;
      // Register challenger. Should be ok to re-register a challenger
      await nf3Challenger.registerChallenger();
      // Reset challenger earnings
      await nf3Challenger.withdrawChallengerEarnings();
      // De-register challenger
      await nf3Challenger.deregisterChallenger();
      // Configure adversary bad block sequence
      logger.debug(`Configuring Challenge Type ${process.env.CHALLENGE_TYPE}`);
      await chai
        .request(environment.adversarialOptimistApiUrl)
        .post('/block/gen-block')
        .send({ blockType: ['ValidBlock', 'ValidBlock', 'IncorrectTreeRoot'] });

      // we pause the challenger queue and don't process challenger until unpauseQueueChallenger
      nf3Challenger.pauseQueueChallenger();
      // retrieve initial balance
      challengerInitialEarnings = Number((await nf3Challenger.checkChallengerEarnings()).amount);

      // we are creating a block of deposits with high values such that there is
      // enough balance for a lot of transfers with low value.
      for (let j = 0; j < TRANSACTIONS_PER_BLOCK; j++) {
        await nf3User.deposit(ercAddress, tokenType, value, tokenId, fee);
      }

      for (let i = 0; i < TEST_LENGTH_TRANSFER; i++) {
        await waitForSufficientBalance(nf3User, value);
        try {
          await nf3User.transfer(
            false,
            ercAddress,
            tokenType,
            value,
            tokenId,
            nf3User.zkpKeys.compressedZkpPublicKey,
          );
        } catch (err) {
          if (err.message.includes('No suitable commitments')) {
            // if we get here, it's possible that a block we are waiting for has not been proposed yet
            // let's wait 10x normal and then try again
            console.log(
              `No suitable commitments were found for transfer. I will wait ${
                0.01 * TX_WAIT
              } seconds and try one last time`,
            );
            await new Promise(resolve => setTimeout(resolve, 10 * TX_WAIT));
            await nf3User.transfer(
              false,
              ercAddress,
              tokenType,
              value,
              tokenId,
              nf3User.zkpKeys.compressedZkpPublicKey,
            );
          }
        }
        for (let k = 0; k < TRANSACTIONS_PER_BLOCK - 1; k++) {
          await nf3User.deposit(ercAddress, tokenType, value, tokenId);
        }
        await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
        console.log(`Completed ${i + 1} pings`);
      }

      await new Promise(resolve => setTimeout(resolve, 30 * TX_WAIT));
      challengerFinalEarnings = Number((await nf3Challenger.checkChallengerEarnings()).amount);
      console.log(`Challenger Initial Earnings`, challengerInitialEarnings);
      console.log(`Challenger Final Earnings`, challengerFinalEarnings);
      expect(challengerFinalEarnings).to.be.equal(0);
    });
  });

  after(async () => {
    // stopping registerProposerOnNoProposer
    clearInterval(intervalId);
    nf3User.close();
    nf3AdversarialProposer.close();
    nf3Challenger.close();
  });
});
