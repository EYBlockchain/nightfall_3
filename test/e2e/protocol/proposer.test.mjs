/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Nf3 from '../../../cli/lib/nf3.mjs';
import { Web3Client, expectTransaction } from '../../utils.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { signingKeys } = config.RESTRICTIONS;
const { bond, gasCosts, mnemonics, signingKeys: testSigningKeys } = config.TEST_OPTIONS;

const bootProposer = new Nf3(signingKeys.bootProposerKey, environment);
const testProposer = new Nf3(testSigningKeys.proposer1, environment);

const testProposersUrl = [
  'http://test-proposer1',
  'http://test-proposer2',
  'http://test-proposer3',
  'http://test-proposer4',
];

const web3Client = new Web3Client();

describe('Basic Proposer tests', () => {
  before(async () => {
    await testProposer.init(mnemonics.proposer);
    await bootProposer.init(mnemonics.proposer);
  });

  it('should register the boot proposer', async () => {
    let proposers;
    ({ proposers } = await bootProposer.getProposers());

    // we have to pay 10 ETH to be registered
    const startBalance = await web3Client.getBalance(bootProposer.ethereumAddress);
    const res = await bootProposer.registerProposer(testProposersUrl[0]);
    expectTransaction(res);

    ({ proposers } = await bootProposer.getProposers());
    const endBalance = await web3Client.getBalance(bootProposer.ethereumAddress);
    expect(startBalance - endBalance).to.closeTo(bond, gasCosts);
    const thisProposer = proposers.filter(p => p.thisAddress === bootProposer.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    expect(thisProposer[0].url).to.be.equal(testProposersUrl[0]);
  });

  it('should fail to register a proposer other than the boot proposer', async () => {
    try {
      const res = await testProposer.registerProposer();
      expectTransaction(res);
    } catch (error) {
      expect(error.message).to.satisfy(message =>
        message.includes('Transaction has been reverted by the EVM'),
      );
    }
  });

  it('should update proposers url', async () => {
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
    try {
      const res = await bootProposer.registerProposer(testProposersUrl[2]);
      expectTransaction(res);

      expect.fail('Submitting the same proposer registration should have caused an EVM revert');
    } catch (err) {
      expect(err.message).to.include('Transaction has been reverted by the EVM');
    }
  });

  it('should unregister the boot proposer', async () => {
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
    let error = null;
    try {
      await bootProposer.withdrawBond();
    } catch (err) {
      error = err;
    }
    expect(error.message).to.satisfy(
      message =>
        message.includes(
          'Returned error: VM Exception while processing transaction: revert It is too soon to withdraw your bond',
        ) || message.includes('Transaction has been reverted by the EVM'),
    );
  });

  it('Should create a passing withdrawBond (because sufficient time has passed)', async () => {
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
      expect(error.message).to.include('Transaction has been reverted by the EVM');
    }
  });

  after(async () => {
    // After the proposer tests, unregister proposers
    await testProposer.close();
    await bootProposer.close();
    web3Client.closeWeb3();
  });
});
