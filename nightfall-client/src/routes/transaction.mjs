/**
 * Routes for interacting with client transactions data.
 */
import express from 'express';
import { getTransactionByTransactionHash } from '../services/database.mjs';

const router = express.Router();

router.get('/status/:l2Hash', async (req, res, next) => {
  const { l2Hash } = req.params;

  try {
    const transaction = await getTransactionByTransactionHash(l2Hash);
    const blockNumberL2 = transaction === null ? -1 : transaction?.blockNumberL2;
    // TODO - for null results, query proposers mempool (to discuss)
    res.json({ blockNumberL2 });
  } catch (err) {
    res.json({ error: err.message });
    next(err);
  }
});

export default router;
