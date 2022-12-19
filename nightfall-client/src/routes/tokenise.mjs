import express from 'express';
import tokenise from '../services/tokenise.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { rawTransaction: txDataToSign, transaction } = await tokenise(req.body);
    // convert commitment from GN to hex form for transmission
    res.json({ txDataToSign, transaction });
  } catch (err) {
    res.json({ error: err.message });
    next(err);
  }
});

export default router;
