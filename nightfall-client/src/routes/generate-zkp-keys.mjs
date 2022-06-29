/**
Route for transferring a crypto commitment.
*/

import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { zkpKeys } from '../services/keys.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug(`generate keys endpoint received POST`);
  try {
    const { mnemonic, addressIndex } = req.body;
    const keys = await zkpKeys.generateZkpKeysFromMnemonic(mnemonic, addressIndex);
    logger.debug('returning zkp keys generated');
    res.json(keys);
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
