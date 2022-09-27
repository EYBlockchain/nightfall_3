import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import setInstantWithdrawl from '../services/instant-withdrawal.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { rawTransaction: txDataToSign } = await setInstantWithdrawl(req.body);
    // convert commitment from GN to hex form for transmission
    res.json({ txDataToSign });
  } catch (err) {
    next(err);
  }
});

export default router;
