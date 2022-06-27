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
} from './utils.mjs';
import logger from '../common-files/utils/logger.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { TRANSACTIONS_PER_BLOCK } = config;
const TX_WAIT = 12000;
const TEST_LENGTH = 4;

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
  const value1 = 1000;
  const value2 = 5;

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

    nf3Challenger = new Nf3(ethereumSigningKeyChallenger, environment);

    // Generate a random mnemonic (uses crypto.randomBytes under the hood), defaults to 128-bits of entropy
    await nf3User.init(mnemonicUser);
    await nf3AdversarialProposer.init(mnemonicProposer);
    await nf3Challenger.init(mnemonicChallenger);

    // retrieve initial balance
    startBalance = await retrieveL2Balance(nf3User);

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
  });

  describe('User creates deposit and transfer transctions', () => {
    it('User should have the correct balance after a series of rollbacks', async () => {
      // Because rollbacks removes the only registered proposer,
      // the proposer is registered again after each remova
      intervalId = setInterval(() => {
        registerProposerOnNoProposer(nf3AdversarialProposer);
      }, 5000);

      // we are creating a block of deposits with high values such that there is
      // enough balance for a lot of transfers with low value.
      for (let j = 0; j < TRANSACTIONS_PER_BLOCK; j++) {
        await nf3User.deposit(ercAddress, tokenType, value1, tokenId, fee);
        expectedBalance += value1;
      }

      for (let i = 0; i < TEST_LENGTH; i++) {
        await waitForSufficientBalance(nf3User, value2);
        try {
          await nf3User.transfer(
            false,
            ercAddress,
            tokenType,
            value2,
            tokenId,
            nf3User.zkpKeys.compressedPkd,
          );
          // expectedBalance += value2;
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
              nf3User.zkpKeys.compressedPkd,
            );
            // expectedBalance += value2; // transfer to self, so balance does not increase
          }
        }
        for (let k = 0; k < TRANSACTIONS_PER_BLOCK - 1; k++) {
          await nf3User.deposit(ercAddress, tokenType, value2, tokenId);
          expectedBalance += value2;
        }
        await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
        console.log(`Completed ${i + 1} pings`);
      }

      // waiting sometime to ensure that all the good transactions from bad
      // blocks were proposed in other good blocks
      await new Promise(resolve => setTimeout(resolve, 20 * TX_WAIT));
      const endBalance = await retrieveL2Balance(nf3User);
      console.log(`Completed startBalance`, startBalance);
      console.log(`Completed endBalance`, endBalance);
      expect(expectedBalance).to.be.equal(endBalance - startBalance);
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
