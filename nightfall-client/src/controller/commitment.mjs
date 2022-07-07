import { getAllCommitments } from '../services/commitment-storage.mjs';

/**
 * @function getCommitmentsByCompressedPkd is a controller to take care of some logic
 * between the route endpoint and the service function.
 * @param {string | undefined} compressedPkd the compressed pkd derivated from the user
 * mnemonic coming from the SDK or Wallet.
 * @returns if the paramenter is different of undefined, returns all the
 * commitments existent for this compressed pkd. Else returns all the commitments
 * in the database.
 * @author luizoamorim
 */
function getCommitmentsByCompressedPkd(compressedPkd) {
  const commitments = getAllCommitments(compressedPkd);
  return commitments;
}

export default getCommitmentsByCompressedPkd;
