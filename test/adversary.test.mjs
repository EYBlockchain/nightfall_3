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
import { waitForProposer, waitForSufficientBalance } from './utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { TRANSACTIONS_PER_BLOCK } = config;
const TX_WAIT = 12000;
const TEST_LENGTH = 16;

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
      // we are creating a block of tests such that there will always be
      // enough balance for a transfer. We do this by submitting and mining (waiting until)
      // deposits of value required for a transfer
      // let count = 0;
      for (let j = 0; j < TRANSACTIONS_PER_BLOCK; j++) {
        // TODO set this loop to TRANSACTIONS_PER_BLOCK
        await waitForProposer(nf3AdversarialProposer);
        const res = await nf3User1.deposit(ercAddress, tokenType, value1, tokenId, fee);
        expect(res).to.have.property('transactionHash');
        expect(res).to.have.property('blockHash');
        // console.log('HERE count', count);
        // count++;
      }

      for (let i = 0; i < TEST_LENGTH; i++) {
        await waitForProposer(nf3AdversarialProposer);
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
          // console.log('HERE count', count);
          // count++;
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
            await waitForProposer(nf3AdversarialProposer);
            await new Promise(resolve => setTimeout(resolve, TX_WAIT));
            await nf3User1.transfer(
              false,
              ercAddress,
              tokenType,
              value2,
              tokenId,
              nf3User1.zkpKeys.compressedPkd,
            );
            // console.log('HERE count', count);
            // count++;
          }
        }
        await nf3User1.deposit(ercAddress, tokenType, value2, tokenId);
        await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
        console.log(`Completed ${i + 1} pings`);
      }
    });
  });

  after(async () => {
    // wait for pending transactions before closing
    await new Promise(resolve => setTimeout(resolve, 60000));
    nf3User1.close();
    nf3AdversarialProposer.close();
    nf3Challenger.close();
  });
});
