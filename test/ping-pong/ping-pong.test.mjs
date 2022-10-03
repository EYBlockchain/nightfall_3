import config from 'config';
import localTest from './index.mjs';
import Nf3 from '../../cli/lib/nf3.mjs';

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { mnemonics, signingKeys, MINIMUM_STAKE } = config.TEST_OPTIONS;
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

describe('Ping-pong tests', () => {
  before(async () => {
    await nf3Proposer.init(mnemonics.proposer);
    // we must set the URL from the point of view of the client container
    await nf3Proposer.registerProposer('http://optimist', MINIMUM_STAKE);
    await nf3Proposer.startProposer();
  });

  it('Runs ping-pong tests', async () => {
    localTest(true);
    await localTest(false);
  });

  after(async () => {
    if (process.env.ENVIRONMENT !== 'aws') {
      await nf3Proposer.deregisterProposer();
      await nf3Proposer.close();
    }
  });
});
