/**
Route for transferring a crypto commitment.
*/

import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { ZkpKeys } from '../services/keys.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { mnemonic, addressIndex } = req.body;
    const keys = await ZkpKeys.generateZkpKeysFromMnemonic(mnemonic, addressIndex);
    res.json(keys);
  } catch (err) {
    next(err);
  }
});

export default router;
