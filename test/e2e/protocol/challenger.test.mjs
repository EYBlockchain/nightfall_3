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

const { signingKeys } = config.RESTRICTIONS;
const { mnemonics } = config.TEST_OPTIONS;

const bootChallenger = new Nf3(signingKeys.bootChallengerKey, environment);
console.log(environment);

describe('Basic Challenger tests', () => {
  before(async () => {
    await bootChallenger.init(mnemonics.challenger);
  });

  it('should register the boot challenger', async () => {
    // Challenger registration
    await bootChallenger.registerChallenger();
    // Chalenger listening for incoming events
    bootChallenger.startChallenger();
  });

  it('should de-register a challenger', async () => {
    const res = await bootChallenger.deregisterChallenger();
    expect(res.status).to.be.equal(200);
  });

  after(async () => {
    await bootChallenger.close();
  });
});
