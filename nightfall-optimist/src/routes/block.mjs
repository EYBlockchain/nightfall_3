/**
 * Routes for checking that a block is valid.
 */
import express from 'express';
import { checkBlock } from '../services/check-block.mjs';
import Block from '../classes/block.mjs';
import { resetUnsuccessfulBlockProposedTransactions } from '../services/database.mjs';
import { setMakeNow } from '../services/block-assembler.mjs';
import auth from '../utils/auth.mjs';

const router = express.Router();

router.post('/check', auth, async (req, res, next) => {
  try {
    const { block, transactions } = req.body;
    const result = await checkBlock(block, transactions);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/make-now', auth, async (req, res, next) => {
  try {
    logger.debug(`block make-now endpoint received GET`);
    setMakeNow();
    res.send('Making short block');
  } catch (err) {
    next(err);
  }
});

router.get('/reset-localblock', auth, async (req, res, next) => {
  try {
    await Block.rollback();
    await resetUnsuccessfulBlockProposedTransactions();
    res.json({ resetstatus: true });
  } catch (err) {
    next(err);
  }
});

export default router;
