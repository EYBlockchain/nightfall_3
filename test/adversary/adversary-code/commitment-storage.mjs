/* eslint-disable import/prefer-default-export */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

// ignore unused exports
export async function getCommitmentsByHashFaulty(
  hashes,
  compressedZkpPublicKey,
  ercAddress,
  tokenId,
) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitment = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({
      _id: { $in: hashes },
      compressedZkpPublicKey: compressedZkpPublicKey.hex(32),
      'preimage.ercAddress': generalise(ercAddress).hex(32),
      'preimage.tokenId': generalise(tokenId).hex(32),
    })
    .toArray();
  return commitment;
}

async function getAvailableCommitmentsFaulty(db, compressedZkpPublicKey, ercAddress, tokenId) {
  return db
    .collection(COMMITMENTS_COLLECTION)
    .find({
      compressedZkpPublicKey: compressedZkpPublicKey.hex(32),
      'preimage.ercAddress': ercAddress.hex(32),
      'preimage.tokenId': tokenId.hex(32),
      $or: [{ isNullified: true }, { isPendingNullification: true }],
    })
    .toArray();
}
