/* This is an example script written to show how to send blockConfig which provides a configuration
 * for valid and invalid blocks to be built by adversary. This does not perform negative tests because testing
 * if the adversary is able to create successful bad blocks or not is not the objective of nightfall 3 tests
 * Any test written should verify the state of client's expected balance against the balance that blockchain says
 * the client should have
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
const TEST_LENGTH = 7;

// Number of transfer filled transaction blocks required.
// This is equal to the number of blocks required for test that
// uses blockConfig - 1. We reduce by 1 because we want the first
// block to hold deposit big enough for the subsequent transfers
// and will create this ahead of the transfer blocks separately

describe('Testing the challenge http API', () => {
  let nf3User1;
  let nf3AdversarialProposer;
  let ercAddress;
  let nf3Challenger;
  let startBalance;

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

  describe('Create L2 state with valid blocks and transactions', () => {
    it('should create a block with 2 deposits then as many transfers as set by TEST_LENGTH', async () => {
      // registerProposerOnNoProposer(nf3AdversarialProposer);
      const intervalId = setInterval(() => {
        registerProposerOnNoProposer(nf3AdversarialProposer);
      }, 5000);

      // we are creating a block of tests such that there will always be
      // enough balance for a transfer. We do this by submitting and mining (waiting until)
      // deposits of value required for a transfer
      for (let j = 0; j < TRANSACTIONS_PER_BLOCK; j++) {
        // TODO set this loop to TRANSACTIONS_PER_BLOCK
        const res = await nf3User1.deposit(ercAddress, tokenType, value1, tokenId, fee);
        expect(res).to.have.property('transactionHash');
        expect(res).to.have.property('blockHash');
      }

      // Balance from good block commitments only
      // Balance by two commitments not total (which might be only one commit)
      // wait for sufficient balance and proposer has to wait for 12 block confirmations
      // proposer to not be zero
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
          }
        }
        await nf3User1.deposit(ercAddress, tokenType, value2, tokenId);
        await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain

        // More transactions for a block to ensure there are commitments to be spent for upcoming transfer
        // When continuous rollbacks happen, there are no commitments for transfer as the prior commitments from deposits
        // are in a state of pending to be in added in a block. These deposits ensure there are enough commitments. Otherwise
        // we rely on the intial deposit of 2000 which ends being 1995 subsequently and is not sufficient for a tranfers of 5 because
        // two commitments are needed
        await waitForSufficientBalance(nf3User1, value2);
        await nf3User1.deposit(ercAddress, tokenType, value2, tokenId);
        await nf3User1.deposit(ercAddress, tokenType, value2, tokenId);
        await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
        console.log(`Completed ${i + 1} pings`);
      }
      clearInterval(intervalId);
    });
  });

  after(async () => {
    // wait for pending transactions before closing
    await new Promise(resolve => setTimeout(resolve, 60000));
    const endBalance = await retrieveL2Balance(nf3User1);

    // + 1000 Deposit
    // + 1000 Deposit

    //  The following 7 times
    //   5 Transfer to self. So no change
    // + 5 Deposit
    // + 5 Deposit
    // + 5 Deposit

    // 2000 + 15 * 7 = 2105

    if (endBalance - startBalance === 2105) {
      console.log('Test passed');
      console.log('Balance of User ', endBalance - startBalance);
    } else {
      console.log(
        'The test has not yet passed because the L2 balance has not increased - waiting',
        endBalance - startBalance,
      );
    }
    nf3User1.close();
    nf3AdversarialProposer.close();
    nf3Challenger.close();
  });
});
