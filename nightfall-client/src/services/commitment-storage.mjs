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
const { generalise } = gen;

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
export async function findUsableCommitments(zkpPublicKey, ercAddress, tokenId, _value, onlyOne) {
  const value = generalise(_value); // sometimes this is sent as a BigInt.
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(COMMITMENTS_DB);
  const commitmentArray = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({
      'preimage.zkpPublicKey': zkpPublicKey.hex(32),
      'preimage.ercAddress': ercAddress.hex(32),
      'preimage.tokenId': tokenId.hex(32),
      isNullified: false,
    })
    .toArray();
  if (commitmentArray === []) return null;
  // turn the commitments into real commitment objects
  const commitments = commitmentArray.map(ct => new Commitment(ct.preimage));
  // now we need to treat different cases
  // if we have an exact match, we can do a single-commitment transfer.
  // this function will tell us.
  const singleCommitment = (async () => {
    for (const commitment of commitments) {
      console.log('INDEX', await commitment.index);
      if (commitment.preimage.value.hex(32) === value.hex(32)) {
        // check if Timber knows about the commitment
        if ((await commitment.index) == null) return null;
        logger.info('Found commitment suitable for single transfer or withdraw');
        return [commitment];
      }
    }
    return null;
  })();
  if (await singleCommitment) return singleCommitment;
  if (onlyOne) return null; // sometimes we require just one commitment
  // if not, maybe we can do a two-commitment transfer, this is a expensive search and this function will tell us:
  return (async () => {
    for (let i = 0; i < commitments.length; i++) {
      // check Timber holds the commitment
      if ((await commitments[i].index) === null) break;
      const innerResult = (async () => {
        for (let j = i + 1; j < commitments.length; j++) {
          // check Timber holds the commitment
          if ((await commitments[j].index) === null) break;
          if (
            commitments[i].preimage.value.bigInt + commitments[j].preimage.value.bigInt >
            value.bigInt
          ) {
            logger.info('Found commitments suitable for two-token transfer');
            return [commitments[i], commitments[j]];
          }
        }
        return null;
      })();
      if (await innerResult) return innerResult;
    }
    return null;
  })();
}
