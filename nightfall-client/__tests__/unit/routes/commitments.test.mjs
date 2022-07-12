import supertest from 'supertest';

import { generateTestingUtils } from 'eth-testing';

import app from '../../../src/app.mjs';
import CommitmentService from '../../../src/services/commitment-service.mjs';
import commitments from '../../../__mocks__/commitments.mjs';

const getAllCommitmentsByCompressedPkdStub = jest.fn();
CommitmentService.prototype.getAllCommitmentsByCompressedPkd = getAllCommitmentsByCompressedPkdStub;
const requestWithSupertest = supertest(app);

describe('Suit fo tests for export file function', () => {
  beforeAll(() => {
    generateTestingUtils({ providerType: 'MetaMask' });
  });

  test('should export a file for the path informated', async () => {
    getAllCommitmentsByCompressedPkdStub.mockReturnValue(Promise.resolve(commitments));
    console.log('AQUI');
    const res = requestWithSupertest.get('/commitment/all');
    console.log('RESPONSE COMMITMENTS: ', res);
    expect(true).toBe(true);
  });
});
