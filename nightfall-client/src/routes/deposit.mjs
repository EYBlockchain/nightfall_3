/**
Route for depositing (minting) a crypto commitment.
This code assumes that the Shield contract already has approval to spend
funds on a zkp deposit
*/
import express from 'express';
import deposit from '../services/deposit.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { rawTransaction: txDataToSign, transaction } = await deposit(req.body);
    // convert commitment from GN to hex form for transmission
    res.json({ txDataToSign, transaction });
  } catch (err) {
    next(err);
  }
});

export default router;
