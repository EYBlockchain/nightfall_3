/**
Route for transferring a crypto commitment.
*/
import config from 'config';
import express from 'express';
import transfer from '../services/transfer.mjs';
import transferRegulator from '../services/transfer-regulator.mjs';

const { REGULATOR_URL } = config;
const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    let txDataToSign;
    let transaction;

    if (!REGULATOR_URL) {
      ({ rawTransaction: txDataToSign, transaction } = await transfer(req.body));
    } else {
      ({ rawTransaction: txDataToSign, transaction } = await transferRegulator(req.body));
    }
    res.json({ txDataToSign, transaction });
  } catch (err) {
    res.json({ error: err.message });
    next(err);
  }
});

export default router;
