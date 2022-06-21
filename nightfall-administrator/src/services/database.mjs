import mongo from '../../../common-files/utils/mongo.mjs';

const MONGO_URL = 'mongodb://localhost:27017/';
const DB = 'administration';
const COLLECTION = 'signatures';

/**
Function to save a signed transaction, ready for the multisig
*/
export async function saveSigned(sig, tx) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(DB);
  // we key by transaction data and signer's public key
  return db.collection(COLLECTION).insertOne({ _id: tx.data.concat(tx.from.slice(2)), sig, tx });
}

/**
Function to check that there are enough transactions to send some signed data
*/
export async function checkThreshold(data) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(DB);
  const query = { 'tx.data': data };
  return db.collection(COLLECTION).countDocuments(query);
}

/**
Function to get the signatures
*/
export async function getSigned(data) {
  const connection = await mongo.connection(MONGO_URL);
  const db = connection.db(DB);
  console.log('DATA', data);
  const query = { 'tx.data': data };
  return db.collection(COLLECTION).find(query).toArray();
}
