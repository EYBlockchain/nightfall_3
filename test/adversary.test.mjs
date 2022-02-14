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

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { TRANSACTIONS_PER_BLOCK } = config;
const TX_WAIT = 12000;
const TEST_LENGTH = 8;

describe('Testing with an adversary', () => {
  let nf3User1;
  let nf3AdversarialProposer;
  let ercAddress;
  let nf3Challenger;
  let startBalance;
  let expectedBalance = 0;
  let intervalId;

  // this is the etherum private key for accounts[0] and so on
  const ethereumSigningKeyUser1 =
    '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const ethereumSigningKeyProposer =
    '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d';
  const ethereumSigningKeyChallenger =
    '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb';
  const mnemonicUser1 =
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
    nf3User1 = new Nf3('ws://localhost:8546', ethereumSigningKeyUser1, {
      clientApiUrl: 'http://localhost:8080',
      optimistApiUrl: 'http://localhost:8081',
      optimistWsUrl: 'ws://localhost:8082',
    });

    nf3AdversarialProposer = new Nf3('ws://localhost:8546', ethereumSigningKeyProposer, {
      clientApiUrl: 'http://localhost:8080',
      optimistApiUrl: 'http://localhost:8088',
      optimistWsUrl: 'ws://localhost:8089',
    });

    nf3Challenger = new Nf3('ws://localhost:8546', ethereumSigningKeyChallenger, {
      clientApiUrl: 'http://localhost:8080',
      optimistApiUrl: 'http://localhost:8081',
      optimistWsUrl: 'ws://localhost:8082',
    });

    // Generate a random mnemonic (uses crypto.randomBytes under the hood), defaults to 128-bits of entropy
    await nf3User1.init(mnemonicUser1);
    await nf3AdversarialProposer.init(mnemonicProposer);
    await nf3Challenger.init(mnemonicChallenger);

    // retrieve initial balance
    startBalance = await retrieveL2Balance(nf3User1);

    if (!(await nf3User1.healthcheck('optimist'))) throw new Error('Healthcheck failed');
    if (!(await nf3AdversarialProposer.healthcheck('optimist')))
      throw new Error('Healthcheck failed');
    if (!(await nf3Challenger.healthcheck('optimist'))) throw new Error('Healthcheck failed');

    // Proposer registration
    await nf3AdversarialProposer.registerProposer();
    // Proposer listening for incoming events
    nf3AdversarialProposer.startProposer();
    ercAddress = await nf3User1.getContractAddress('ERC20Mock');

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
        await nf3User1.deposit(ercAddress, tokenType, value1, tokenId, fee);
        expectedBalance += value1;
      }

      for (let i = 0; i < TEST_LENGTH; i++) {
        await waitForSufficientBalance(nf3User1, value2);
        try {
          await nf3User1.transfer(
            false,
            ercAddress,
            tokenType,
            value2,
            tokenId,
            nf3User1.zkpKeys.compressedPkd,
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
            await nf3User1.transfer(
              false,
              ercAddress,
              tokenType,
              value2,
              tokenId,
              nf3User1.zkpKeys.compressedPkd,
            );
            // expectedBalance += value2; // transfer to self, so balance does not increase
          }
        }
        await nf3User1.deposit(ercAddress, tokenType, value2, tokenId);
        expectedBalance += value2;
        await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
        console.log(`Completed ${i + 1} pings`);
      }

      // waiting sometime to ensure that all the good transactions from bad
      // blocks were proposed in other good blocks
      await new Promise(resolve => setTimeout(resolve, 20 * TX_WAIT));
      const endBalance = await retrieveL2Balance(nf3User1);

      expect(expectedBalance).to.be.equal(endBalance - startBalance);
    });
  });

  after(async () => {
    // stopping registerProposerOnNoProposer
    clearInterval(intervalId);
    nf3User1.close();
    nf3AdversarialProposer.close();
    nf3Challenger.close();
  });
});
