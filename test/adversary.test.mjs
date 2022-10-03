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
const { MINIMUM_STAKE } = config.TEST_OPTIONS;
const TX_WAIT = 12000;
const TEST_LENGTH = 3;

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

describe('Testing with an adversary', () => {
  let nf3User;
  let nf3AdversarialProposer;
  let ercAddress;
  let nf3Challenger;
  let startBalance;
  let expectedBalance = 0;
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
  // const value1 = 1000;
  const value2 = 5;

  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;

  before(async () => {
    console.log(`CHALLENGE_TYPE: ${process.env.CHALLENGE_TYPE}`);
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
      optimistApiUrl,
      optimistWsUrl,
    });

    // Generate a random mnemonic (uses crypto.randomBytes under the hood), defaults to 128-bits of entropy
    await nf3User.init(mnemonicUser);
    await nf3AdversarialProposer.init(mnemonicProposer);
    await nf3Challenger.init(mnemonicChallenger);

    if (!(await nf3User.healthcheck('client'))) throw new Error('Healthcheck failed');
    if (!(await nf3AdversarialProposer.healthcheck('optimist')))
      throw new Error('Healthcheck failed');
    if (!(await nf3Challenger.healthcheck('optimist'))) throw new Error('Healthcheck failed');

    // retrieve initial balance
    ercAddress = await nf3User.getContractAddress('ERC20Mock');
    startBalance = await retrieveL2Balance(nf3User);

    // initiating proposed websocket connection for optimist ran as challenger
    // this bit of a code added as work-around to a bug in code
    // Bug is, when a optimist only spinned as challenger
    // after a rollback we queue a job called `signalRollbackCompleted`
    // inside in which we look for ws(websocket) of a propser continuously via
    // while loop since optimist container only has challenger this case never satisfies
    // and 'Error(`Websocket to proposer has failed`)'is throw and optimist crash
    // meanwhile blockProposeEventHandler job never get picked from queue.
    await nf3Challenger.startProposer();

    // Proposer registration
    await nf3AdversarialProposer.registerProposer('', MINIMUM_STAKE);
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
    // Because rollbacks removes the only registered proposer,
    // the proposer is registered again after each removal
    intervalId = setInterval(() => {
      registerProposerOnNoProposer(nf3AdversarialProposer);
    }, 5000);

    // Chalenger listening for incoming events
    const challengeEmitter = await nf3Challenger.startChallenger();
    challengeEmitter
      .on('receipt', (receipt, type) => {
        logger.debug(
          `Challenge of type ${type} has been submitted to the blockchain. The L1 transaction hash is ${receipt.transactionHash}`,
        );
      })
      .on('error', (error, type) => {
        logger.error(
          `Challenge transaction to the blochain of type ${type} failed due to error: ${error} `,
        );
      });

    // for now optimist containers at time for startup state-sync code logic
    // starts challenger by calling startMakingChallenges() function
    // that reason explicitly call stop challenge api for nf3AdversarialProposer
    await nf3AdversarialProposer.challengeEnable(false);

    // Configure adversary bad block sequence
    if (process.env.CHALLENGE_TYPE !== '') {
      logger.debug(`Configuring Challenge Type ${process.env.CHALLENGE_TYPE}`);
      await chai
        .request(adversarialOptimistApiUrl)
        .post('/block/gen-block')
        .send({ blockType: ['ValidBlock', 'ValidBlock', process.env.CHALLENGE_TYPE] });
    } else {
      logger.debug(`Configuring Default Challenge Type`);
    }

    // console.log('Pausing challenger queue...');
    // nf3Challenger.pauseQueueChallenger();
  });

  describe('User creates deposit and transfer transactions', () => {
    it('User should have the correct balance after a series of rollbacks', async () => {
      // Because rollbacks removes the only registered proposer,
      // the proposer is registered again after each remova
      intervalId = setInterval(() => {
        registerProposerOnNoProposer(nf3AdversarialProposer);
      }, 5000);
      let nDeposits = 0;
      let nTransfers = 0;
      let nWithdraws = 0;

      // we are creating a block of deposits with high values such that there is
      // enough balance for a lot of transfers with low value.
      console.log('Starting balance :', startBalance);
      expectedBalance = startBalance;
      for (let j = 0; j < TRANSACTIONS_PER_BLOCK; j++) {
        await nf3User.deposit(ercAddress, tokenType, value2, tokenId, fee);
        nDeposits++;
        expectedBalance += value2;
      }
      console.log('Number of deposits', nDeposits);
      for (let i = 0; i < TEST_LENGTH; i++) {
        await waitForSufficientBalance(
          nf3User,
          startBalance + (i + 1) * (TRANSACTIONS_PER_BLOCK - 1) * value2,
        );
        try {
          await nf3User.transfer(
            false,
            ercAddress,
            tokenType,
            value2,
            tokenId,
            nf3User.zkpKeys.compressedZkpPublicKey,
            0,
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
              value2,
              tokenId,
              nf3User.zkpKeys.compressedZkpPublicKey,
              0,
            );
            nTransfers++;
          }
        }
        console.log('Number of transfers', nTransfers);
        for (let k = 0; k < TRANSACTIONS_PER_BLOCK - 1; k++) {
          await nf3User.deposit(ercAddress, tokenType, value2, tokenId, fee);
          nDeposits++;
          expectedBalance += value2;
        }
        console.log('Number of deposits', nDeposits);
        await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
        console.log(`Completed ${i + 1} pings with expectedBalance ${expectedBalance}`);
      }

      await waitForSufficientBalance(nf3User, value2);
      try {
        await nf3User.withdraw(
          false,
          ercAddress,
          tokenType,
          value2,
          tokenId,
          nf3User.ethereumAddress,
          0,
        );
        nWithdraws++;
        expectedBalance -= value2;
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
            value2,
            tokenId,
            nf3User.ethereumAddress,
            0,
          );
          nWithdraws++;
          expectedBalance -= value2;
        }
      }
      for (let k = 0; k < TRANSACTIONS_PER_BLOCK - 1; k++) {
        await nf3User.deposit(ercAddress, tokenType, value2, tokenId, fee);
        nDeposits++;
        expectedBalance += value2;
      }

      // TODO:_ how can i check that queue 2 is empty
      logger.debug(
        `N deposits: ${nDeposits} - N Transfers: ${nTransfers} - N Withdraws: ${nWithdraws}`,
      );
      await new Promise(resolve => setTimeout(resolve, 20 * TX_WAIT));
      await waitForSufficientBalance(nf3User, expectedBalance);
      const endBalance = await retrieveL2Balance(nf3User);
      console.log(`Completed startBalance`, startBalance);
      console.log(`Completed endBalance`, endBalance);
      expect(expectedBalance).to.be.equal(endBalance);
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
