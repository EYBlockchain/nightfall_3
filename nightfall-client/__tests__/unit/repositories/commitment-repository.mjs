/* eslint-disable @babel/no-unused-expressions */
import { deepStrictEqual } from 'assert';
import CommitmentService from '../../../src/services/commitment-service.mjs';
import commitments from '../../../__mocks__/commitments.mjs';
import TestCommitmentRepository from '../../inMemoryDatabases/commitment.mjs';

const COMPRESSED_PKD = '0x3b95fab23c3445b1af3a48570298541bf7742cd8e14644fd4242442a61a67c38';
const testServiceGetAllCommitmentsByCompressedPkd = async () => {
  const commitmentService = new CommitmentService(new TestCommitmentRepository());
  const commitmentsByCompressedPkd = await commitmentService.getAllCommitmentsByCompressedPkd(
    COMPRESSED_PKD,
  );
  deepStrictEqual(
    commitmentsByCompressedPkd,
    commitments.find(commitment => commitment.preimage.compressedPkd === COMPRESSED_PKD),
  );
};

export default testServiceGetAllCommitmentsByCompressedPkd;
