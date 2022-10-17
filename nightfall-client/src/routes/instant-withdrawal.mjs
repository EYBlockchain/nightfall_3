import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import setInstantWithdrawl from '../services/instant-withdrawal.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  logger.debug(`instant-withdrawal endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const { rawTransaction: txDataToSign } = await setInstantWithdrawl(req.body);
    logger.debug('returning raw transaction');
    logger.trace(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    // convert commitment from GN to hex form for transmission
    res.json({ txDataToSign });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
