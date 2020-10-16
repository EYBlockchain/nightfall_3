/**
Logic for storing and retrieving commitments from a mongo DB.  Abstracted from
deposit/transfer/withdraw
*/
import config from 'config';
import mongo from '../utils/mongo.mjs';
import logger from '../utils/logger.mjs';
import Commitment from '../classes/commitment.mjs';

const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;

// function to format a commitment for a mongo db and store it
export async function storeCommitment(commitment) {
  const connection = await mongo.connection(MONGO_URL);
  const data = {
    _id: commitment.hash.hex(32),
    preImage: commitment.preImage.all.hex(32),
  };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).insertOne(data);
}

// function to find commitments that can be used in the proposed transfer
export async function findUsableCommittments(zkpPublicKey, ercAddress, tokenId, value) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({
      'preImage.zkpPublicKey': zkpPublicKey.hex(32),
      'preImage.ercAddress': ercAddress.hex(32),
      'preImage.tokenId': tokenId.hex(32),
    })
    .toArray();
  if (commitments === []) return null;
  // now we need to treat different cases
  // if we have an exact match, we can do a single-commitment transfer.
  // this function will tell us:
  const singleCommitment = (() => {
    for (const commitment of commitments) {
      if (commitment.preImage.value === value.hex(32)) {
        logger.info('Found commitment suitable for single transfer');
        return [new Commitment(commitment.preImage)];
      }
    }
    return null;
  })();
  if (singleCommitment) return singleCommitment;
  // if not, maybe we can do a two-commitment transfer, this is a expensive search and this function will tell us:
  return (() => {
    for (const commitmentC of commitments) {
      const innerResult = (() => {
        for (const commitmentD of commitments) {
          if (
            BigInt(commitmentC.preImage.value) + BigInt(commitmentD.preImage.value) >
            value.bigInt
          ) {
            logger.info('Found commitments suitable for two-token transfer');
            return [new Commitment(commitmentC.preImage), new Commitment(commitmentD.preImage)];
          }
        }
        return null;
      })();
      if (innerResult) return innerResult;
    }
    return null;
  })();
}
