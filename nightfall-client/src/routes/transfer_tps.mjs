/**
Route for transferring a crypto commitment.
*/
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import transfer from '../services/transfer_tps.mjs';

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
  try {
    const { rawTransaction: txDataToSign, transaction } = await transfer(req.body);
    res.json({ txDataToSign, transaction });
  } catch (err) {
    logger.error(err);
    if (err.message.includes('No suitable commitments')) {
      logger.info('Returning "No suitable commitments" error');
      res.json({ error: 'No suitable commitments' });
    } else {
      next(err);
    }
  }
});

export default router;
