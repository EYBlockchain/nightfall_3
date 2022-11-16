import express from 'express';
import { getDebugCounters } from '../services/debug-counters.mjs';
import auth from '../utils/auth.mjs';

const router = express.Router();

router.get('/counters', auth, async (req, res, next) => {
  try {
    const counters = getDebugCounters();
    res.json({ counters });
  } catch (err) {
    next(err);
  }
});

export default router;
