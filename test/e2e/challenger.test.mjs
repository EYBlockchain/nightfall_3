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
const signingKeys = require('./signingKeys.json');
const mnemonics = require('./mnemonics.json');

const environment = environments[network] || environments.localhost;
const nf3Challenger = new Nf3(web3WsUrl, signingKeys.challenger, environment);

before(async () => {
  await nf3Challenger.init(mnemonics.challenger);
  // Challenger registration
  await nf3Challenger.registerChallenger();
  // Chalenger listening for incoming events
  nf3Challenger.startChallenger();
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
});

after(async () => {
  // After the challenger tests, re-register challenger
  await nf3Challenger.registerChallenger();
  await nf3Challenger.close();
});
