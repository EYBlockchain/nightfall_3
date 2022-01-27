import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import { createRequire } from 'module';
import Nf3 from '../../cli/lib/nf3.mjs';

// so we can use require with mjs file
const require = createRequire(import.meta.url);
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const { web3WsUrl, network } = process.env;

// we need require here to import jsons
const environments = require('./environments.json');
const mnemonics = require('./mnemonics.json');
const signingKeys = require('./signingKeys.json');

const environment = environments[network];
const nf3Proposer1 = new Nf3(web3WsUrl, signingKeys.proposer1, environment);
const nf3Proposer2 = new Nf3(web3WsUrl, signingKeys.proposer2, environment);
const nf3Proposer3 = new Nf3(web3WsUrl, signingKeys.proposer3, environment);

before(async () => {
  await nf3Proposer1.init(mnemonics.proposer);
  await nf3Proposer2.init(mnemonics.proposer);
  await nf3Proposer3.init(mnemonics.proposer);
});

describe('Basic Proposer tests', () => {
  it('should register a proposer', async () => {
    let proposers;
    ({ proposers } = await nf3Proposer2.getProposers());
    // we have to pay 10 ETH to be registered
    const startBalance = await getBalance(nf3Proposer2.ethereumAddress);
    const res = await nf3Proposer2.registerProposer();
    stateBalance += bond;
    expectTransaction(res);
    ({ proposers } = await nf3Proposer2.getProposers());
    const endBalance = await getBalance(nf3Proposer2.ethereumAddress);
    expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
    const thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer2.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
  });

  it('should register other proposer', async () => {
    let proposers;
    ({ proposers } = await nf3Proposer3.getProposers());
    // we have to pay 10 ETH to be registered
    const startBalance = await getBalance(nf3Proposer3.ethereumAddress);
    const res = await nf3Proposer3.registerProposer();
    stateBalance += bond;
    expectTransaction(res);
    ({ proposers } = await nf3Proposer3.getProposers());
    const endBalance = await getBalance(nf3Proposer3.ethereumAddress);
    expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
    const thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer3.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
  });

  it('should de-register a proposer', async () => {
    let proposers;
    ({ proposers } = await nf3Proposer1.getProposers());
    let thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer1.ethereumAddress);
    expect(thisProposer.length).to.be.equal(1);
    const res = await nf3Proposer1.deregisterProposer();
    expectTransaction(res);
    ({ proposers } = await nf3Proposer1.getProposers());
    thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer1.ethereumAddress);
    expect(thisProposer.length).to.be.equal(0);
  });

  it('Should create a failing withdrawBond (because insufficient time has passed)', async () => {
    let error = null;
    try {
      await nf3Proposer1.withdrawBond();
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
    if (nodeInfo.includes('TestRPC')) await timeJump(3600 * 24 * 10); // jump in time by 7 days
    if (nodeInfo.includes('TestRPC')) {
      const res = await nf3Proposer1.withdrawBond();
      expectTransaction(res);
    } else {
      let error = null;
      try {
        await nf3Proposer1.withdrawBond();
      } catch (err) {
        error = err;
      }
      expect(error.message).to.include('Transaction has been reverted by the EVM');
    }
  });

  after(async () => {
    // After the proposer tests, re-register proposers
    await nf3Proposer2.deregisterProposer();
    await nf3Proposer3.deregisterProposer();
    await nf3Proposer1.registerProposer();
    stateBalance += bond;
  });
});
