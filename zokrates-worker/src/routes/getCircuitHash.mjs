import express from 'express';
import getCircuitHash from '../services/getCircuitHash.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  req.setTimeout(3600000); // 1 hour
  try {
    res.send(await getCircuitHash(req.body));
  } catch (err) {
    next(err);
  }
});

export default router;
