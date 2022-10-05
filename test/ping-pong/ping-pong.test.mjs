import config from 'config';
import axios from 'axios';
import localTest from './index.mjs';

const { MINIMUM_STAKE } = config.TEST_OPTIONS;

describe('Ping-pong tests', () => {
  before(async () => {
    await axios.post('http://localhost:8092/proposer', {
      bond: MINIMUM_STAKE,
      url: 'http://proposer',
    });
  });

  it('Runs ping-pong tests', async () => {
    localTest(true);
    await localTest(false);
  });

  after(async () => {
    await axios.delete('http://localhost:8092/proposer');
  });
});
