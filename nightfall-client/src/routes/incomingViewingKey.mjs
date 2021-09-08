/**
Route for setting the decryption key that will be used to decrypt secrets during block proposed event handler stage
*/

import express from 'express';
import { generalise } from 'general-number';
import logger from 'common-files/utils/logger.mjs';
import {
  subscribeToBlockProposedEvent,
  blockProposedEventHandler,
} from '../event-handlers/index.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug(`Incoming Viewing Key endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { ivk, nsk } = generalise(req.body);
    subscribeToBlockProposedEvent(blockProposedEventHandler, ivk.bigInt, nsk.bigInt);
    res.json({ status: 'success' });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
