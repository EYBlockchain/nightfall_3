/* This is an example script written to show how to send blockConfig which provides a configuration
 * for valid and invalid blocks to be built by adversary. This does not perform negative tests because testing
 * if the adversary is able to create successful bad blocks or not is not the objective of nightfall 3 tests
 * Any test written should verify the state of client's expected balance against the balance that blockchain says
 * the client should have
 */

/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import { generateMnemonic } from 'bip39';
import Nf3 from '../cli/lib/nf3.mjs';
import { sendBlockConfig, waitForProposer, waitForSufficientBalance } from './utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const blockConfig = [
  'ValidBlock',
  'ValidBlock',
  'IncorrectRoot',
  // 'DuplicateTransaction',
  // 'InvalidTransaction',
  // 'IncorrectHistoricRoot',
  // 'IncorrectProof',
  // 'DuplicateNullifier',
  // 'IncorrectLeafCount',
  // 'ValidBlock',
];

// Number of transfer filled transaction blocks required.
// This is equal to the number of blocks required for test that
// uses blockConfig - 1. We reduce by 1 because we want the first
// block to hold deposit big enough for the subsequent transfers
// and will create this ahead of the transfer blocks separately
const TEST_LENGTH = blockConfig.length - 1;

describe('Testing the challenge http API', () => {
  let nf3User1;
  let nf3User2;
  // let nf3Proposer;
  let nf3AdversarialProposer;
  let nf3Challenger;
  let ercAddress;

  const USE_INFURA = process.env.USE_INFURA === 'true';
  const { ETH_PRIVATE_KEY } = process.env;

  // this is the etherum private key for accounts[0] and so on
  let ethereumSigningKeyUser1 =
    '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const ethereumSigningKeyUser2 =
    '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb';
  const ethereumSigningKeyProposer =
    '0x72fc398f06b17e1fa5e3dbd9909861172438c8bd4433ce006d7a63ba1b8382d2';
  let ethereumSigningKeyChallenger =
    '0x371c406a2b27499324ecc45343283465b411508ebbb073e8d05caeea115c4006';

  // TODO ETH_PRIVATE_KEY during USE_INFURA should use different addresses for user and challenger
  if (USE_INFURA) {
    if (!ETH_PRIVATE_KEY) {
      throw Error(
        'Cannot use default private key, please set environment variable ETH_PRIVATE_KEY',
      );
    }
    ethereumSigningKeyUser1 = ETH_PRIVATE_KEY;
    ethereumSigningKeyChallenger = ETH_PRIVATE_KEY;
  }

  const tokenId = '0x0000000000000000000000000000000000000000000000000000000000000000'; // has to be zero for ERC20
  const tokenType = 'ERC20'; // it can be 'ERC721' or 'ERC1155'
  const value1 = 1000;
  const value2 = 5;

  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;
  const txPerBlock = 2;

  before(async () => {
    nf3User1 = new Nf3(
      'http://localhost:8080',
      'http://localhost:8081',
      'ws://localhost:8082',
      'ws://localhost:8546',
      ethereumSigningKeyUser1,
    );

    nf3User2 = new Nf3(
      'http://localhost:8080',
      'http://localhost:8081',
      'ws://localhost:8082',
      'ws://localhost:8546',
      ethereumSigningKeyUser2,
    );

    // nf3Proposer = new Nf3(
    //   'http://localhost:8080',
    //   'http://localhost:8081',
    //   'ws://localhost:8082',
    //   'ws://localhost:8546',
    //   ethereumSigningKeyProposer,
    // );

    nf3AdversarialProposer = new Nf3(
      'http://localhost:8080',
      'http://localhost:8088',
      'ws://localhost:8089',
      'ws://localhost:8546',
      ethereumSigningKeyProposer,
    );

    nf3Challenger = new Nf3(
      'http://localhost:8080',
      'http://localhost:8085',
      'ws://localhost:8086',
      'ws://localhost:8546',
      ethereumSigningKeyChallenger,
    );

    // Generate a random mnemonic (uses crypto.randomBytes under the hood), defaults to 128-bits of entropy
    const mnemonic = generateMnemonic();

    await nf3User1.init(mnemonic, 0);
    await nf3User2.init(mnemonic, 1);
    // await nf3Proposer.init(mnemonic, 2);
    await nf3AdversarialProposer.init(mnemonic, 2);
    await nf3Challenger.init(mnemonic, 3);

    if (!(await nf3User1.healthcheck('client'))) throw new Error('Healthcheck failed');
    if (!(await nf3User2.healthcheck('client'))) throw new Error('Healthcheck failed');
    if (!(await nf3AdversarialProposer.healthcheck('optimist')))
      throw new Error('Healthcheck failed');
    if (!(await nf3Challenger.healthcheck('optimist'))) throw new Error('Healthcheck failed');

    // Proposer registration
    await nf3AdversarialProposer.registerProposer();
    // Proposer listening for incoming events
    nf3AdversarialProposer.startProposer();
    // Challenger registration
    await nf3Challenger.registerChallenger();
    // Chalenger listening for incoming events
    nf3Challenger.startChallenger();
    // Send block config to adversarial proposer
    await sendBlockConfig(nf3AdversarialProposer.optimistBaseUrl, blockConfig);

    ercAddress = await nf3User1.getContractAddress('ERCStub');
  });

  describe('Basic Challenger tests', () => {
    it('should register a challenger', async () => {
      const res = await nf3Challenger.registerChallenger();
      expect(res.status).to.be.equal(200);
    });

    it('should de-register a challenger', async () => {
      const res = await nf3Challenger.deregisterChallenger();
      expect(res.status).to.be.equal(200);
    });

    it('should register a challenger', async () => {
      const res = await nf3Challenger.registerChallenger();
      expect(res.status).to.be.equal(200);
    });
  });

  describe('Create L2 state with valid blocks and transactions', () => {
    it('should create a block with 2 deposits then as many transfers as set by TEST_LENGTH', async () => {
      // we are creating a block of tests such that there will always be
      // enough balance for a transfer. We do this by submitting and mining (waiting until)
      // deposits of value required for a transfer
      // let count = 0;
      const depositFunction = async () => {
        await nf3User1.deposit(ercAddress, tokenType, value1, tokenId, fee);
      };

      for (let j = 0; j < txPerBlock; j++) {
        // TODO set this loop to TRANSACTIONS_PER_BLOCK
        await waitForProposer(nf3AdversarialProposer);
        const res = await nf3User1.deposit(ercAddress, tokenType, value1, tokenId, fee);
        expect(res).to.have.property('transactionHash');
        expect(res).to.have.property('blockHash');
        // count += 1;
        // console.log('count', count);
      }

      for (let i = 0; i < TEST_LENGTH; i++) {
        for (let j = 0; j < txPerBlock; j++) {
          // this proposer might have been challenged and removed as a
          // result. We register the proposer again to continue the
          // tests. We only have one proposer registered at anytime for
          // these tests
          await waitForProposer(nf3AdversarialProposer);
          // ensure there is sufficient balance for transfer.
          // this function relies on a prior deposit of
          // similar value being made
          await waitForSufficientBalance(nf3User1, value2, depositFunction);
          const resT1 = await nf3User1.transfer(
            false,
            ercAddress,
            tokenType,
            value2,
            tokenId,
            nf3User1.zkpKeys.pkd,
            fee,
          );
          expect(resT1).to.have.property('transactionHash');
          expect(resT1).to.have.property('blockHash');
          // count += 1;

          // console.log('count', count);
          await new Promise(resolve => setTimeout(resolve, 20000));
        }
      }
    });
  });

  after(async () => {
    // wait for pending transactions before closing
    await new Promise(resolve => setTimeout(resolve, 20000));
    nf3User1.close();
    nf3User2.close();
    nf3AdversarialProposer.close();
    nf3Challenger.close();
  });
});
