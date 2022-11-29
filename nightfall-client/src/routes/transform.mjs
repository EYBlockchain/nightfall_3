import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import transform from '../services/transform.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { rawTransaction: txDataToSign, transaction } = await transform(req.body);
    logger.debug('returning raw transaction');
    logger.trace(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
    // convert commitment from GN to hex form for transmission
    res.json({ txDataToSign, transaction });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
