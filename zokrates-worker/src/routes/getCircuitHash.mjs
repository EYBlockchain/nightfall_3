import express from 'express';
import getCircuitHash from '../services/getCircuitHash.mjs';

const router = express.Router();

router.get('/', async (req, res, next) => {
  req.setTimeout(3600000); // 1 hour
  try {
    const { circuit } = req.query;
    res.send(await getCircuitHash(circuit));
  } catch (err) {
    next(err);
  }
});

export default router;
