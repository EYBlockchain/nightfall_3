import Repository from '../../src/repositories/repository.mjs';
import commitments from '../../__mocks__/commitments.mjs';

export default class TestCommitmentRepository extends Repository {
  getAllCommitmentsByCompressedPkd = async compressedPkd => {
    return new Promise(resolve => {
      const commitmentsByCompressedPkd = commitments.find(
        commitment => commitment.preimage.compressedPkd === compressedPkd,
      );
      resolve(commitmentsByCompressedPkd);
    });
  };
}
