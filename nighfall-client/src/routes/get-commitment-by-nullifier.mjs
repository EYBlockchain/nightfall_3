/**
 * Route to allow a transfer message (which may have been received by a system
 *  external to Nightfall, to be check for validity by Nightfall.
 */
import express from 'express';
import logger from '../utils/logger.mjs';
import { getCommitmentByNullifier } from '../services/commitment-storage.mjs';

const router = express.Router();

router.get('/', async (req, res, next) => {
  logger.debug(
    `get-commitment-by-nullifier endpoint received GET ${JSON.stringify(req.query, null, 2)}`,
  );
  try {
    const result = await getCommitmentByNullifier(req.query.nullifier, req.query.zkpPrivateKey);
    logger.debug(`returning result ${result}`);
    res.json({ valid: result });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
