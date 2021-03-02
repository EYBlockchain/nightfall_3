import express from 'express';
import generateProof from '../services/generateProof.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  req.setTimeout(3600000); // 1 hour

  try {
    res.send(await generateProof(req.body));
  } catch (err) {
    next(err);
  }
});

export default router;
