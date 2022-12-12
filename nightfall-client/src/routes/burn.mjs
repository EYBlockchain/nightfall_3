import express from 'express';
import burn from '../services/burn.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { rawTransaction: txDataToSign, transaction } = await burn(req.body);
    // convert commitment from GN to hex form for transmission
    res.json({ txDataToSign, transaction });
  } catch (err) {
    next(err);
  }
});

export default router;
