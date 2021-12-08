/**
Route for transferring a crypto commitment.
*/

import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { generalise } from 'general-number';
import { generateKeys, decompressKey } from '../services/keys.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug(`generate keys endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { mnemonic, path } = req.body;
    const keys = await generateKeys(mnemonic, path);
    logger.debug('returning keys');
    logger.silly(`the keys are ${JSON.stringify(keys, null, 2)}`);
    res.json(keys);
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

router.post('/decompress', async (req, res, next) => {
  logger.debug(`decompressing keys endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { compressedPkd } = generalise(req.body);
    const decompressedPkd = await decompressKey(compressedPkd);
    logger.debug('returning keys');
    logger.silly(`the keys are ${JSON.stringify(decompressedPkd, null, 2)}`);
    res.json({ pkd: [decompressedPkd[0].hex(), decompressedPkd[1].hex()] });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
