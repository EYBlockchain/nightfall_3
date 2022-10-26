/**
Route for transferring a crypto commitment.
*/
import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import transfer from '../services/transfer.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { rawTransaction: txDataToSign, transaction } = await transfer(req.body);
    res.json({ txDataToSign, transaction });
  } catch (err) {
    if (err.message.includes('No suitable commitments')) {
      logger.info('Returning "No suitable commitments" error');
      res.json({ error: 'No suitable commitments' });
    } else {
      next(err);
    }
  }
});

export default router;
