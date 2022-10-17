import config from 'config';
import { userTest, proposerTest } from './index.mjs';
import Nf3 from '../../cli/lib/nf3.mjs';

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { mnemonics, signingKeys } = config.TEST_OPTIONS;
let nf3Proposer;

describe('Ping-pong tests', () => {
  before(async () => {
    if (process.env.ENVIRONMENT !== 'aws' && !process.env.NO_PROPOSERS) {
      nf3Proposer = new Nf3(signingKeys.proposer1, environment);
      await nf3Proposer.init(mnemonics.proposer);
      // we must set the URL from the point of view of the client container
      await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());
      await nf3Proposer.startProposer();
    }
  });

  it('Runs ping-pong tests', async () => {
    userTest(true);
    proposerTest();
    await userTest(false);
  });

  after(async () => {
    if (process.env.ENVIRONMENT !== 'aws' && !process.env.NO_PROPOSERS) {
      await nf3Proposer.deregisterProposer();
      await nf3Proposer.close();
    }
  });
});
