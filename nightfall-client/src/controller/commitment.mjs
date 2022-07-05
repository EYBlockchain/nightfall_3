import { getAllCommitments } from '../services/commitment-storage.mjs';

function getCommitmentsByCompressedPkd(param) {
  const commitments = getAllCommitments(param);
  return commitments;
}

export default getCommitmentsByCompressedPkd;
