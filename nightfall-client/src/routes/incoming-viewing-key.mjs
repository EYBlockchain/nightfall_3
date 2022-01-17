/**
Route for setting the decryption key that will be used to decrypt secrets during block proposed event handler stage
*/

import express from 'express';
import { generalise } from 'general-number';
import logger from 'common-files/utils/logger.mjs';
import { enqueueEvent } from 'common-files/utils/event-queue.mjs';
import { initialClientSync } from '../services/state-sync.mjs';
import { storeMemoryKeysForDecryption } from '../services/keys.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug(`Incoming Viewing Key endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { ivks, nsks } = generalise(req.body);
    await storeMemoryKeysForDecryption(
      ivks.map(ivk => ivk.bigInt),
      nsks.map(nsk => nsk.bigInt),
    );
    enqueueEvent(initialClientSync, 0);
    res.json({ status: 'success' });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
