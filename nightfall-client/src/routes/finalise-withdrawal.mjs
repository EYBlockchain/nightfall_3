/**
Route for depositing (minting) a crypto commitment.
This code assumes that the Shield contract already has approval to spend
funds on a zkp deposit
*/
import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { finaliseWithdrawal } from '../services/finalise-withdrawal.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { transactionHash } = req.body;
    const { rawTransaction: txDataToSign } = await finaliseWithdrawal(transactionHash);
    // convert commitment from GN to hex form for transmission
    res.json({ txDataToSign });
  } catch (err) {
    next(err);
  }
});

export default router;
