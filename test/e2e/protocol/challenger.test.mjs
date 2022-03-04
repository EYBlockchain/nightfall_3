/* eslint-disable no-await-in-loop */
import chai from 'chai';
import config from 'config';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../../../cli/lib/nf3.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { mnemonics, signingKeys } = config.TEST_OPTIONS;

const nf3Challenger = new Nf3(signingKeys.challenger, environment);

describe('Basic Challenger tests', () => {
  before(async () => {
    await nf3Challenger.init(mnemonics.challenger);
    // Challenger registration
    await nf3Challenger.registerChallenger();
    // Challenger listening for incoming events
    nf3Challenger.startChallenger();
  });

  it('should register a challenger', async () => {
    const res = await nf3Challenger.registerChallenger();
    expect(res.status).to.be.equal(200);
  });

  it('should de-register a challenger', async () => {
    const res = await nf3Challenger.deregisterChallenger();
    expect(res.status).to.be.equal(200);
  });

  after(async () => {
    await nf3Challenger.close();
  });
});
