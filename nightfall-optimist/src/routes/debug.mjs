import express from 'express';
import { getDebugCounters } from '../services/debug-counters.mjs';

const router = express.Router();

router.get('/counters', async (req, res, next) => {
  try {
    const counters = getDebugCounters();
    res.json({ counters });
  } catch (err) {
    next(err);
  }
});

export default router;
