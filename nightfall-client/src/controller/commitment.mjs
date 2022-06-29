import { getAllCommitments } from '../services/commitment-storage.mjs';

function getCommitmentsByCompressedPkd() {
  const commitments = getAllCommitments();
  return commitments;
}

export default getCommitmentsByCompressedPkd;
