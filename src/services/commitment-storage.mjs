/**
Logic for storing and retrieving commitments from a mongo DB.  Abstracted from
deposit/transfer/withdraw
*/
import config from 'config';
import gen from 'general-number';
import mongo from '../utils/mongo.mjs';
import logger from '../utils/logger.mjs';
import Commitment from '../classes/commitment.mjs';

const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;
const { GN } = gen;

// function to drop the commitment collection (useful for testing)
export async function dropCommitments() {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).drop();
}

// function to format a commitment for a mongo db and store it
export async function storeCommitment(commitment) {
  const connection = await mongo.connection(MONGO_URL);
  const data = {
    _id: commitment.hash.hex(32),
    preimage: commitment.preimage.all.hex(32),
    isNullified: commitment.isNullified,
  };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).insertOne(data);
}

// function to mark a commitment as nullified for a mongo db
export async function markNullified(commitment) {
  const connection = await mongo.connection(MONGO_URL);
  const query = { _id: commitment.hash.hex(32) };
  const update = { $set: { isNullified: true } };
  const db = connection.db(COMMITMENTS_DB);
  return db.collection(COMMITMENTS_COLLECTION).updateOne(query, update);
}

// function to find commitments that can be used in the proposed transfer
export async function findUsableCommitments(zkpPublicKey, ercAddress, tokenId, _value) {
  const value = new GN(_value); // sometimes this is sent as a BigInt.
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitments = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({
      'preimage.zkpPublicKey': zkpPublicKey.hex(32),
      'preimage.ercAddress': ercAddress.hex(32),
      'preimage.tokenId': tokenId.hex(32),
      isNullified: false,
    })
    .toArray();
  if (commitments === []) return null;
  // now we need to treat different cases
  // if we have an exact match, we can do a single-commitment transfer.
  // this function will tell us:
  const singleCommitment = (() => {
    for (const commitment of commitments) {
      if (commitment.preimage.value === value.hex(32)) {
        logger.info('Found commitment suitable for single transfer');
        return [new Commitment(commitment.preimage)];
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
            BigInt(commitmentC.preimage.value) + BigInt(commitmentD.preimage.value) >
            value.bigInt
          ) {
            logger.info('Found commitments suitable for two-token transfer');
            return [new Commitment(commitmentC.preimage), new Commitment(commitmentD.preimage)];
          }
        }
        return null;
      })();
      if (innerResult) return innerResult;
    }
    return null;
  })();
}
