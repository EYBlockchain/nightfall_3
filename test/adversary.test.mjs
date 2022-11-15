/* This adversary test relies on the bad block and bad tranasction types as defined in
 * test/adversary/adversary-code/database.mjs and test/adversary/adversary-code/block.mjs
 * files. Later this test will work against random selection of bad block and bad
 * tranasction types
 */

/* eslint-disable no-await-in-loop */
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

// instead of our usual cli we need to import
// adversary transpiled version of cli.
// please do not forget to run `npm run build-adversary`
// eslint-disable-next-line import/no-unresolved
import Nf3 from './adversary/adversary-cli/lib/nf3.mjs';

import { registerProposerOnNoProposer, Web3Client } from './utils.mjs';

chai.use(chaiHttp);
chai.use(chaiAsPromised);

// const TX_WAIT = 12000;

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const web3Client = new Web3Client();

let stateAddress;
const eventLogs = [];

const challengeSelectors = {
  challengeRoot: '0x25009307',
  challengeCommitment: '0x1c80a5a5',
  challengeHistoricRoot: '0xf0b86f27',
  challengeLeafCount: '0xb8424d42',
  challengeFrontier: '0x60f611d5',
  challengeNullifier: '0xda5370ca',
  challengeProofVerification: '0xf04b3b10',
};

describe('Testing with an adversary', () => {
  let nf3User;
  let nf3AdversarialProposer;
  let blockProposeEmitter;
  let challengeEmitter;
  let ercAddress;
  let nf3Challenger;
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
  let rollbackCount = 0;
  let currentRollbacks = 0;
  let challengeSelector;

  const waitForRollback = async () => {
    while (rollbackCount !== currentRollbacks + 1) {
      console.log(
        'Rollback count: ',
        rollbackCount,
        ' - ',
        'Expected number of rollbacks: ',
        currentRollbacks + 1,
      );
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  };

  before(async () => {
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

    // Proposer registration
    await nf3AdversarialProposer.registerProposer(
      'http://optimist',
      await nf3AdversarialProposer.getMinimumStake(),
    );
    // Proposer listening for incoming events
    blockProposeEmitter = await nf3AdversarialProposer.startProposer();
    blockProposeEmitter
      .on('receipt', (receipt, block) => {
        logger.debug(
          `L2 Block with L2 block number ${block.blockNumberL2} was proposed. The L1 transaction hash is ${receipt.transactionHash}`,
        );
      })
      .on('submit-transaction-receipt', (receipt, transactions) => {
        logger.debug(
          `bad transaction submitted, transactionHash is ${transactions[0].transactionHash}`,
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
    challengeEmitter = await nf3Challenger.startChallenger();
    challengeEmitter
      .on('receipt', (receipt, type, txSelector) => {
        logger.debug(
          `Challenge of type ${type} has been submitted to the blockchain. The L1 transaction hash is ${receipt.transactionHash}`,
        );
        challengeSelector = txSelector;
      })
      .on('error', (error, type, txSelector) => {
        logger.error(
          `Challenge transaction to the blochain of type ${type} failed due to error: ${error} `,
        );
        challengeSelector = txSelector;
      })
      .on('rollback', () => {
        rollbackCount += 1;
        logger.debug(
          `Challenger received a signalRollback complete, Now no. of rollbacks are ${rollbackCount}`,
        );
      });

    stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    await nf3User.deposit(ercAddress, tokenType, value2, tokenId, 0);
    await nf3AdversarialProposer.makeBlockNow('ValidTransaction');
    await web3Client.waitForEvent(eventLogs, ['blockProposed']);

    await nf3User.transfer(
      false,
      ercAddress,
      tokenType,
      value2,
      tokenId,
      nf3User.zkpKeys.compressedZkpPublicKey,
      0,
    );
    await nf3AdversarialProposer.makeBlockNow('ValidTransaction');
    await web3Client.waitForEvent(eventLogs, ['blockProposed']);

    await nf3User.withdraw(
      false,
      ercAddress,
      tokenType,
      value2,
      tokenId,
      nf3User.ethereumAddress,
      0,
    );
    await nf3AdversarialProposer.makeBlockNow('ValidTransaction');
    await web3Client.waitForEvent(eventLogs, ['blockProposed']);
  });

  beforeEach(() => {
    currentRollbacks = rollbackCount;
  });

  describe('Testing bad transactions', () => {
    it('Test duplicate commitment transfer', async () => {
      console.log('Testing duplicate commitment transfer...');
      await nf3AdversarialProposer.makeBlockNow('DuplicateCommitmentTransfer');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback duplicate commitment transfer completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeCommitment);
    });

    it('Test duplicate commitment deposit', async () => {
      console.log('Testing duplicate commitment deposit...');
      await nf3AdversarialProposer.makeBlockNow('DuplicateCommitmentDeposit');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback duplicate commitment deposit completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeCommitment);
    });

    it('Test duplicate nullifier transfer', async () => {
      console.log('Testing duplicate nullifier transfer...');
      await nf3AdversarialProposer.makeBlockNow('DuplicateNullifierTransfer');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback duplicate nullifier transfer completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeNullifier);
    });

    it('Test duplicate nullifier withdraw', async () => {
      console.log('Testing duplicate nullifier withdraw...');
      await nf3AdversarialProposer.makeBlockNow('DuplicateNullifierWithdraw');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback  duplicate nullifier withdraw completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeNullifier);
    });

    it('Test incorrect proof deposit', async () => {
      console.log('Testing incorrect proof deposit...');
      await nf3AdversarialProposer.makeBlockNow('IncorrectProofDeposit');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback incorrect proof deposit completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeProofVerification);
    });

    it('Test incorrect proof transfer', async () => {
      console.log('Testing incorrect proof transfer...');
      await nf3AdversarialProposer.makeBlockNow('IncorrectProofTransfer');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback  incorrect proof transfer completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeProofVerification);
    });

    it('Test incorrect proof withdraw', async () => {
      console.log('Testing incorrect proof withdraw...');
      await nf3AdversarialProposer.makeBlockNow('IncorrectProofWithdraw');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback incorrect proof withdraw completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeProofVerification);
    });

    it('Test incorrect public input commitment deposit', async () => {
      console.log('Testing incorrect public input commitment deposit...');
      await nf3AdversarialProposer.makeBlockNow('IncorrectPublicInputDepositCommitment');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback incorrect public input commitment deposit completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeProofVerification);
    });

    it('Test incorrect public input transfer commitment', async () => {
      console.log('Testing incorrect public input transfer commitment...');
      await nf3AdversarialProposer.makeBlockNow('IncorrectPublicInputTransferCommitment');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback incorrect public input transfer commitment completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeProofVerification);
    });

    it('Test incorrect public input transfer nullifier', async () => {
      console.log('Testing incorrect public input transfer nullifier...');
      await nf3AdversarialProposer.makeBlockNow('IncorrectPublicInputTransferCommitment');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback incorrect public input transfer nullifier completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeProofVerification);
    });

    it('Test incorrect public input withdraw nullifier', async () => {
      console.log('Testing incorrect public input withdraw nullifier...');
      await nf3AdversarialProposer.makeBlockNow('IncorrectPublicInputWithdrawNullifier');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback incorrect public input withdraw completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeProofVerification);
    });

    it('Test incorrect historic root', async () => {
      console.log('Testing incorrect root...');
      await nf3AdversarialProposer.makeBlockNow('IncorrectHistoricRoot');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback incorrect historic root completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeHistoricRoot);
    });
  });

  describe('Testing bad blocks', async () => {
    before(async () => {
      await nf3User.deposit(ercAddress, tokenType, value2, tokenId, 0);
    });

    it('Test incorrect leaf count', async () => {
      console.log('Testing incorrect leaf count...');
      await nf3AdversarialProposer.makeBlockNow('IncorrectLeafCount');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback incorrect leaf count completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeLeafCount);
    });

    it('Test incorrect tree root', async () => {
      console.log('Testing incorrect tree root...');
      await nf3AdversarialProposer.makeBlockNow('IncorrectTreeRoot');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback incorrect tree root completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeRoot);
    });

    it('Test incorrect frontier hash', async () => {
      console.log('Testing incorrect frontier hash...');
      await nf3AdversarialProposer.makeBlockNow('IncorrectFrontierHash');
      console.log('Waiting for rollback...');
      await waitForRollback();
      console.log('Rollback incorrect frontier hash completed');
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeFrontier);
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
