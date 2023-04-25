import { syncState } from '../nightfall-client/src/services/state-sync.mjs';

describe('Mock Tests', () => {
  it('Check all mocks ', async () => {
    await syncState();
  });
});
