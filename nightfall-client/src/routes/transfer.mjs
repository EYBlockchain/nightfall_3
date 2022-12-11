/**
Route for transferring a crypto commitment.
*/
import express from 'express';
import transfer from '../services/transfer.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { rawTransaction: txDataToSign, transaction } = await transfer(req.body);
    res.json({ txDataToSign, transaction });
  } catch (err) {
    if (err.message.includes('no commitment')) {
      res.json({ error: 'No suitable commitments' });
    } else if (err.message.includes('invalid commitment hashes')) {
      res.json({ error: err.message });
    }
    next(err);
  }
});

export default router;
