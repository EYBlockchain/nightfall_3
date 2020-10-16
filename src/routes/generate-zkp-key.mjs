import express from 'express';
import config from 'config';
import logger from '../utils/logger.mjs';
import sha256 from '../utils/crypto/sha256.mjs';
import mongo from '../utils/mongo.mjs';
import rand from '../utils/crypto/crypto-random.mjs';

const router = express.Router();
const { MONGO_URL, COMMITMENTS_DB, WALLETS_COLLECTION, ZKP_KEY_LENGTH } = config;

router.get('/', async (req, res, next) => {
  logger.debug(`generate-zkp-key endpoint received GET`);
  try {
    // generate a zkp  keypair
    const zkpPrivateKey = await rand(ZKP_KEY_LENGTH);
    const zkpPublicKey = sha256([zkpPrivateKey]);
    logger.info(`generated new zkp private key ${zkpPrivateKey.decimal}`);
    logger.info(`generated new zkp public key ${zkpPublicKey.decimal}`);
    const keyData = { _id: zkpPublicKey.hex(), zkpPrivateKey: zkpPrivateKey.hex() };
    // store the keypair using the public key as the _id
    const connection = await mongo.connection(MONGO_URL);
    const db = connection.db(COMMITMENTS_DB);
    db.collection(WALLETS_COLLECTION).insertOne(keyData);
    logger.info('Stored a new zkp keypair');
    res.json({ keyId: keyData._id });
  } catch (err) {
    next(err);
  }
});

export default router;
