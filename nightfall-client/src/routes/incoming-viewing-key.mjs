/**
Route for setting the decryption key that will be used to decrypt secrets during block proposed event handler stage
*/

import express from 'express';
import { generalise } from 'general-number';
import logger from 'common-files/utils/logger.mjs';
import { storeMemoryKeysForDecryption } from '../services/keys.mjs';
import { clientCommitmentSync } from '../services/commitment-sync.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug(`Incoming Viewing Key endpoint received POST`);
  try {
    const { zkpPrivateKeys, nullifierKeys } = generalise(req.body);
    await storeMemoryKeysForDecryption(
      zkpPrivateKeys.map(zkpPrivateKey => zkpPrivateKey.bigInt),
      nullifierKeys.map(nullifierKey => nullifierKey.bigInt),
    );
    await clientCommitmentSync(
      zkpPrivateKeys.map(zkpPrivateKey => zkpPrivateKey.bigInt),
      nullifierKeys.map(nullifierKey => nullifierKey.bigInt),
    );
    res.json({ status: 'success' });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
