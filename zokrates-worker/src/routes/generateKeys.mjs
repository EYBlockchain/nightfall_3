import express from 'express';
import generateKeys from '../services/generateKeys.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  req.setTimeout(3600000); // 1 hour
  try {
    res.send(await generateKeys(req.body));
  } catch (err) {
    next(err);
  }
});

export default router;
