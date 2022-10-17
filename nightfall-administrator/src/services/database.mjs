import mongo from '@polygon-nightfall/common-files/utils/mongo.mjs';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB = 'administration';
const COLLECTION = 'signatures';

/**
Function to save a signed transaction, ready for the multisig
*/
export async function saveSigned(signed) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(DB);
  // we key by message hash and signer's address
  return db
    .collection(COLLECTION)
    .insertOne({ _id: signed.messageHash.concat(signed.by.slice(2)), ...signed });
}

/**
Function to check that there are enough transactions to send some signed data
*/
export async function checkThreshold(messageHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(DB);
  const query = { messageHash };
  return db.collection(COLLECTION).countDocuments(query);
}

/**
Function to get the signatures
*/
export async function getSigned(messageHash) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(DB);
  const query = { messageHash };
  return db.collection(COLLECTION).find(query).toArray();
}
