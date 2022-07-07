import config from 'config';
import mongo from 'common-files/utils/mongo.mjs';

const { MONGO_URL, COMMITMENTS_DB, COMMITMENTS_COLLECTION } = config;

let connection;
let db;

/**
 * @description initialize the connection with the database
 */
async function initDb() {
  connection = await mongo.connection(MONGO_URL);
  db = connection.db(COMMITMENTS_DB);
}
/**
 *
 * @function getAllCommitments does the communication with the database.
 * @param {string | undefined} compressedPkd the compressed pkd derivated from the user
 * mnemonic coming from the SDK or Wallet.
 * @returns all the commitments in the database.
 * @author luizoamorim
 */
// export async function getAllCommitments() {
//   initDb();

//   const allCommitments = await db.collection(COMMITMENTS_COLLECTION).find({}).toArray();
//   return allCommitments;
// }

/**
 *
 * @function getAllCommitmentsByCompressedPkd does the communication with the database.
 * @param {string | undefined} compressedPkd the compressed pkd derivated from the user
 * mnemonic coming from the SDK or Wallet.
 * @returns all the commitments existent for this compressed pkd.
 * @author luizoamorim
 */
export default async function getAllCommitmentsByCompressedPkd(compressedPkd) {
  initDb();
  const allCommitmentsByCompressedPKD = await db
    .collection(COMMITMENTS_COLLECTION)
    .find({
      'preimage.compressedPkd': compressedPkd.toString(),
    })
    .toArray();
  return allCommitmentsByCompressedPKD;
}
