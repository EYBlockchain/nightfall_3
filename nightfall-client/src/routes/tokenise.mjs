import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import tokenise from '../services/tokenise.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug(`tokenise endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { transaction } = await tokenise(req.body);
    logger.debug('returning raw transaction');
    logger.trace(`ransaction is ${JSON.stringify(transaction, null, 2)}`);
    // convert commitment from GN to hex form for transmission
    res.json({ transaction });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
