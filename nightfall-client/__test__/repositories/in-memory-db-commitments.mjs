import commitments from '../../__mocks__/commitments';

export default function getAllCommitmentsByCompressedPKD(compressedPkd) {
  return commitments.find(commitment => commitment.preimage.compressedPkd === compressedPkd);
}
