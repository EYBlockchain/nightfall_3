import express from 'express';
import transform from '../services/transform.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { rawTransaction: txDataToSign, transaction } = await transform(req.body);
    // convert commitment from GN to hex form for transmission
    res.json({ txDataToSign, transaction });
  } catch (err) {
    next(err);
  }
});

export default router;
