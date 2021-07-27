import express from 'express';
import config from 'config';
import rand from 'common-files/utils/crypto/crypto-random.mjs';
import logger from 'common-files/utils/logger.mjs';

const router = express.Router();
const { ZKP_KEY_LENGTH } = config;
// as we will use the private key as the identifier of the person transacting,
// and we can always generate the public key from the private key on the fly,
// there's no need to store the keypair.
router.get('/', async (req, res, next) => {
  logger.debug(`generate-zkp-key endpoint received GET`);
  try {
    // generate a zkp private key
    const zkpPrivateKey = await rand(ZKP_KEY_LENGTH);
    // if we need the public key in future, generate it like this:
    // const zkpPublicKey = sha256([zkpPrivateKey]);
    logger.info(`generated new zkp private key ${zkpPrivateKey.decimal}`);
    res.json({ keyId: zkpPrivateKey.hex() });
  } catch (err) {
    next(err);
  }
});

export default router;
