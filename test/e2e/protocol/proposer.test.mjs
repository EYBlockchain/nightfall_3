/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import { createRequire } from 'module';
import Nf3 from '../../../cli/lib/nf3.mjs';
import { Web3Client, expectTransaction } from '../../utils.mjs';

// so we can use require with mjs file
const require = createRequire(import.meta.url);
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

// we need require here to import jsons
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const mnemonics = require('../mnemonics.json');
const signingKeys = require('../signingKeys.json');
const { bond, gasCosts, txPerBlock } = require('../configs.json');

const testProposers = [
  new Nf3(signingKeys.proposer1, environment),
  new Nf3(signingKeys.proposer2, environment),
  new Nf3(signingKeys.proposer3, environment),
];

const web3Client = new Web3Client();

describe('Basic Proposer tests', () => {
  before(async () => {
    for (const prop of testProposers) {
      await prop.init(mnemonics.proposer);
    }

    // Proposer registration
    await testProposers[0].registerProposer();

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
    await testProposers[0].addPeer(environment.optimistApiUrl);
  });

  it('should register a proposer', async () => {
    let proposers;
    ({ proposers } = await testProposers[1].getProposers());
    // we have to pay 10 ETH to be registered
    const startBalance = await web3Client.getBalance(testProposers[1].ethereumAddress);
    const res = await testProposers[1].registerProposer();
    expectTransaction(res);
    ({ proposers } = await testProposers[1].getProposers());
    const endBalance = await web3Client.getBalance(testProposers[1].ethereumAddress);
    expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
    const thisProposer = proposers.filter(p => p.thisAddress === testProposers[1].ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
  });

  it('should register other proposer', async () => {
    let proposers;
    ({ proposers } = await testProposers[2].getProposers());
    // we have to pay 10 ETH to be registered
    const startBalance = await web3Client.getBalance(testProposers[2].ethereumAddress);
    const res = await testProposers[2].registerProposer();
    expectTransaction(res);
    ({ proposers } = await testProposers[2].getProposers());
    const endBalance = await web3Client.getBalance(testProposers[2].ethereumAddress);
    expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
    const thisProposer = proposers.filter(p => p.thisAddress === testProposers[2].ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
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
    const { proposers } = await testProposers[0].getProposers();

    for (const prop of testProposers) {
      if (Object.values(proposers[0]).includes(prop.ethereumAddress))
        await prop.deregisterProposer();
      prop.close();
    }

    web3Client.closeWeb3();
  });
});
