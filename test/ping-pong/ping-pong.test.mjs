import localTest from './index.mjs';

describe('Ping-pong tests', () => {
  it('Runs the tests', async () => {
    localTest(1);
    await localTest(2);
  });
});
