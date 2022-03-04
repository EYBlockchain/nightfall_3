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

const { bond, gasCosts, txPerBlock, mnemonics, signingKeys } = config.TEST_OPTIONS;

const testProposers = [
  new Nf3(signingKeys.proposer1, environment),
  new Nf3(signingKeys.proposer2, environment),
  new Nf3(signingKeys.proposer3, environment),
];

const testProposersUrl = [
  'http://test-proposer1',
  'http://test-proposer2',
  'http://test-proposer3',
  'http://test-proposer4',
];

const web3Client = new Web3Client();

describe('Basic Proposer tests', () => {
  before(async () => {
    for (const prop of testProposers) {
      await prop.init(mnemonics.proposer);
    }

    // Proposer registration
    await testProposers[0].registerProposer(testProposersUrl[0]);

    // Proposer listening for incoming events
    const newGasBlockEmitter = await testProposers[0].startProposer();
    newGasBlockEmitter.on('gascost', async gasUsed => {
      if (process.env.VERBOSE)
        console.log(
          `Block proposal gas cost was ${gasUsed}, cost per transaction was ${
            gasUsed / txPerBlock
          }`,
        );
    });
  });

  it('should register a proposer', async () => {
    let proposers;
    ({ proposers } = await testProposers[1].getProposers());
    // we have to pay 10 ETH to be registered
    const startBalance = await web3Client.getBalance(testProposers[1].ethereumAddress);
    const res = await testProposers[1].registerProposer(testProposersUrl[1]);
    expectTransaction(res);
    ({ proposers } = await testProposers[1].getProposers());
    const endBalance = await web3Client.getBalance(testProposers[1].ethereumAddress);
    expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
    const thisProposer = proposers.filter(p => p.thisAddress === testProposers[1].ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    expect(proposers[0].url).to.be.equal(testProposersUrl[0]);
    expect(proposers[1].url).to.be.equal(testProposersUrl[1]);
  });

  it('should register other proposer', async () => {
    let proposers;
    ({ proposers } = await testProposers[2].getProposers());
    // we have to pay 10 ETH to be registered
    const startBalance = await web3Client.getBalance(testProposers[2].ethereumAddress);
    const res = await testProposers[2].registerProposer(testProposersUrl[2]);
    expectTransaction(res);
    ({ proposers } = await testProposers[2].getProposers());
    const endBalance = await web3Client.getBalance(testProposers[2].ethereumAddress);
    expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
    const thisProposer = proposers.filter(p => p.thisAddress === testProposers[2].ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    expect(proposers[0].url).to.be.equal(testProposersUrl[0]);
    expect(proposers[1].url).to.be.equal(testProposersUrl[1]);
    expect(proposers[2].url).to.be.equal(testProposersUrl[2]);
  });

  it('should update proposers url', async () => {
    let proposers;
    ({ proposers } = await testProposers[2].getProposers());
    // we have to pay 10 ETH to be registered
    const res = await testProposers[2].updateProposer(testProposersUrl[3]);
    expectTransaction(res);
    ({ proposers } = await testProposers[2].getProposers());
    const thisProposer = proposers.filter(p => p.thisAddress === testProposers[2].ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    expect(proposers[0].url).to.be.equal(testProposersUrl[0]);
    expect(proposers[1].url).to.be.equal(testProposersUrl[1]);
    expect(proposers[2].url).to.be.equal(testProposersUrl[3]);
  });
  it('should fail to register a proposer twice', async () => {
    try {
      const res = await testProposers[2].registerProposer(testProposersUrl[2]);
      expectTransaction(res);

      expect.fail('Submitting the same proposer registration should have caused an EVM revert');
    } catch (err) {
      expect(err.message).to.include('Transaction has been reverted by the EVM');
    }
  });

  it('should unregister a proposer', async () => {
    let proposers;
    ({ proposers } = await testProposers[0].getProposers());
    let thisProposer = proposers.filter(p => p.thisAddress === testProposers[0].ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    const res = await testProposers[0].deregisterProposer();
    expectTransaction(res);
    ({ proposers } = await testProposers[0].getProposers());
    thisProposer = proposers.filter(p => p.thisAddress === testProposers[0].ethereumAddress);
    expect(thisProposer.length).to.be.equal(0);
    expect(proposers[0].url).to.be.equal(testProposersUrl[1]);
    expect(proposers[1].url).to.be.equal(testProposersUrl[3]);
  });

  it('Should create a failing withdrawBond (because insufficient time has passed)', async () => {
    let error = null;
    try {
      await testProposers[0].withdrawBond();
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
      const res = await testProposers[0].withdrawBond();
      expectTransaction(res);
    } else {
      let error = null;
      try {
        await testProposers[0].withdrawBond();
      } catch (err) {
        error = err;
      }
      expect(error.message).to.include('Transaction has been reverted by the EVM');
    }
  });

  after(async () => {
    // After the proposer tests, de-register proposers
    let { proposers } = await testProposers[0].getProposers();

    for (const prop of testProposers) {
      if (Object.values(proposers[0]).includes(prop.ethereumAddress))
        await prop.deregisterProposer();
      prop.close();
    }
    ({ proposers } = await testProposers[0].getProposers());

    expect(proposers[0].url).to.be.equal('');
    web3Client.closeWeb3();
  });
});
