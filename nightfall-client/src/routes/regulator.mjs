import express from 'express';
import { registerPairSenderReceiver } from '../services/regulator.mjs';

const router = express.Router();

router.post('/registerPairSenderReceiver', async (req, res, next) => {
  try {
    const { PKa, PKb, PKx, intermediateXB } = req.body;
    const { resultSharedSecret, resultPKx } = await registerPairSenderReceiver(
      PKa,
      PKb,
      PKx,
      intermediateXB,
    );
    res.json({ resultSharedSecret, resultPKx });
  } catch (err) {
    next(err);
  }
});

export default router;
