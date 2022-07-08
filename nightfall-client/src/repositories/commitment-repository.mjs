import config from 'config';
import mongo from 'common-files/utils/mongo.mjs';
import Repository from './repository.mjs';

export default class CommitmentRepository extends Repository {
  constructor() {
    super();
    this.MONGO_URL = config.MONGO_URL;
    this.COMMITMENTS_DB = config.COMMITMENTS_DB;
    this.COMMITMENTS_COLLECTION = config.COMMITMENTS_COLLECTION;
  }

  connection;

  db;

  /**
   * @function initDb initialize the connection with the database
   */
  async initDb() {
    this.connection = await mongo.connection(this.MONGO_URL);
    this.db = this.connection.db(this.COMMITMENTS_DB);
  }

  /**
   *
   * @function getAllCommitmentsByCompressedPkd does the communication with the database.
   * @param {string | undefined} compressedPkd the compressed pkd derivated from the user
   * mnemonic coming from the SDK or Wallet.
   * @returns all the commitments existent for this compressed pkd.
   * @author luizoamorim
   */
  async getAllCommitmentsByCompressedPkd(compressedPkd) {
    await this.initDb();
    const allCommitmentsByCompressedPKD = await this.db
      .collection(this.COMMITMENTS_COLLECTION)
      .find({
        'preimage.compressedPkd': compressedPkd.toString(),
      })
      .toArray();
    return allCommitmentsByCompressedPKD;
  }
}
