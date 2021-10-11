/**
Route for transferring a crypto commitment.
*/
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { generateKeys } from '../services/keys.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug(`generate keys endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const keys = await generateKeys();
    logger.debug('returning keys');
    logger.silly(`the keys are ${JSON.stringify(keys, null, 2)}`);
    res.json(keys);
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
