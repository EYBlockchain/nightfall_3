/**
Routes for checking that a block is valid.
*/
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { findBlocksFromBlockNumberL2 } from '../services/database.mjs';

const router = express.Router();

router.get('/blocks/:blockNumberL2', async (req, res, next) => {
  logger.debug('blocks endpoint received get');
  try {
    const { blockNumberL2 } = req.params;
    logger.debug(`searching from block ${blockNumberL2}`);
    // get data to return
    const blocks = await findBlocksFromBlockNumberL2(blockNumberL2);
    if (blocks !== null) {
      res.json({ blocks });
    } else {
      logger.debug('Block not found');
      res.json({ blocks: null });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
