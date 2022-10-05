import { expect } from 'chai';
import hre from 'hardhat';
import config from 'config';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import Nf3 from '../../../cli/lib/nf3.mjs';
import logger from 'common-files/utils/logger.mjs';
import { Web3Client, expectTransaction } from '../../utils.mjs';

const { ethers } = hre;

const { ENVIRONMENTS, TEST_OPTIONS } = config;
const { mnemonics, signingKeys } = TEST_OPTIONS;
const environment = ENVIRONMENTS[process.env.ENVIRONMENT] || ENVIRONMENTS.localhost;

const bootProposer = new Nf3(signingKeys.proposer1, environment);
const testProposer = new Nf3(signingKeys.proposer2, environment);

const testProposersUrl = [
  'http://test-proposer1',
  'http://test-proposer2',
  'http://test-proposer3',
  'http://test-proposer4',
];

// const totalDeposits = txPerBlock * 3;
const nf3User = new Nf3(signingKeys.user1, environment);

const web3Client = new Web3Client();

describe('Basic Proposer tests', () => {
  async function proposerFixture() {
    await nf3User.init(mnemonics.user1);

    await bootProposer.init(mnemonics.proposer);
    await testProposer.init(mnemonics.proposer);
    // Proposer registration
    await bootProposer.registerProposer(testProposersUrl[0]);
    const blockProposeEmitter = await bootProposer.startProposer();
  }

  it('should fail to register a proposer other than the boot proposer', async () => {
    await loadFixture(proposerFixture);
    try {
      const res = await testProposer.registerProposer();
      expectTransaction(res);
    } catch (error) {
      expect(error.message).to.satisfy(message =>
        message.includes('You are not the boot proposer'),
      );
    }
  });

  it('should update proposers url', async () => {
    await loadFixture(proposerFixture);
    let proposers;
    ({ proposers } = await bootProposer.getProposers());
    // we have to pay 10 ETH to be registered
    const res = await bootProposer.updateProposer(testProposersUrl[3]);
    expectTransaction(res);
    ({ proposers } = await bootProposer.getProposers());
    const thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    expect(proposers[0].url).to.be.equal(testProposersUrl[3]);
  });

  it('should fail to register a proposer twice', async () => {
    await loadFixture(proposerFixture);
    const res = await bootProposer.registerProposer(testProposersUrl[2]);
    // eslint-disable-next-line @babel/no-unused-expressions
    expect(res).to.be.false;
  });

  it('should unregister the boot proposer', async () => {
    await loadFixture(proposerFixture);
    let proposers;
    ({ proposers } = await bootProposer.getProposers());
    let thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    const res = await bootProposer.deregisterProposer();
    expectTransaction(res);
    ({ proposers } = await bootProposer.getProposers());
    thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(0);
  });

  it('Should create a failing withdrawBond (because insufficient time has passed)', async () => {
    await loadFixture(proposerFixture);
    let error = null;
    try {
      await bootProposer.withdrawBond();
    } catch (err) {
      error = err;
    }
    console.log(error.message);
    expect(error.message).to.satisfy(
      message => 
        message.includes('It is too soon to withdraw your bond') ||
        message.includes('VM Exception while processing transaction'),
    );
  });

  it('Should create a passing withdrawBond (because sufficient time has passed)', async () => {
    await loadFixture(proposerFixture);
    if ((await web3Client.getInfo()).includes('TestRPC')) await web3Client.timeJump(3600 * 24 * 10); // jump in time by 7 days
    if ((await web3Client.getInfo()).includes('TestRPC')) {
      const res = await bootProposer.withdrawBond();
      expectTransaction(res);
    } else {
      let error = null;
      try {
        await bootProposer.withdrawBond();
      } catch (err) {
        error = err;
      }
      expect(error.message).to.include('VM Exception while processing transaction');
    }
  });

  after(async () => {
    // After the proposer tests, unregister proposers
    testProposer.close();
    bootProposer.close();
    web3Client.closeWeb3();
  });
});
