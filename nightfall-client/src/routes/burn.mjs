import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import burn from '../services/burn.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  const filteredReq = JSON.stringify(
    {
      ...req.body,
      nullifierKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
    },
    null,
    2,
  );
  logger.debug(`burn endpoint received POST ${filteredReq}`);
  try {
    const { rawTransaction: txDataToSign, transaction } = await burn(req.body);
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
