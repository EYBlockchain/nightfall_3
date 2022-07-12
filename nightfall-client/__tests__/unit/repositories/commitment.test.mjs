import CommitmentService from '../../../src/services/commitment-service.mjs';
import commitments from '../../../__mocks__/commitments.mjs';
import TestCommitmentRepository from '../../inMemoryDatabases/commitment.mjs';

describe('Tests from the commitments repository', () => {
  it('', async () => {
    const COMPRESSED_PKD = '0x3b95fab23c3445b1af3a48570298541bf7742cd8e14644fd4242442a61a67c38';

    const commitmentService = new CommitmentService(new TestCommitmentRepository());
    const commitmentsByCompressedPkd = await commitmentService.getAllCommitmentsByCompressedPkd(
      COMPRESSED_PKD,
    );
    expect(commitmentsByCompressedPkd).toBe(
      commitments.find(commitment => commitment.preimage.compressedPkd === COMPRESSED_PKD),
    );
  });
});
