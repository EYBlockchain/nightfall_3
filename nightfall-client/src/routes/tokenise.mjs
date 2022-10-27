import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import tokenise from '../services/tokenise.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  const filteredReq = JSON.stringify(
    {
      ...req.body,
      rootKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
    },
    null,
    2,
  );
  logger.debug(`tokenise endpoint received POST ${filteredReq}`);
  try {
    const { rawTransaction: txDataToSign, transaction } = await tokenise(req.body);
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
