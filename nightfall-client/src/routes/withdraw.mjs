/**
Route for transferring a crypto commitment.
*/
import express from 'express';
import withdraw from '../services/withdraw.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { rawTransaction: txDataToSign, transaction } = await withdraw(req.body);
    res.json({ txDataToSign, transaction });
  } catch (err) {
    res.json({ error: err.message });
    next(err);
  }
});

export default router;
