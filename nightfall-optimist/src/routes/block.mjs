/**
 * Routes for checking that a block is valid.
 */
import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { flushQueue } from '@polygon-nightfall/common-files/utils/event-queue.mjs';
import { checkBlock } from '../services/check-block.mjs';
import Block from '../classes/block.mjs';
import {
  getBlockByTransactionHash,
  getBlockByRoot,
  getTransactionsByTransactionHashes,
  resetUnsuccessfulBlockProposedTransactions,
} from '../services/database.mjs';
import { setMakeNow } from '../services/block-assembler.mjs';

const router = express.Router();

router.post('/check', async (req, res, next) => {
  try {
    const { block, transactions } = req.body;
    const result = await checkBlock(block, transactions);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/make-now', async (req, res, next) => {
  try {
    setMakeNow();
    res.send('Making short block');
  } catch (err) {
    next(err);
  }
});

router.get('/transaction-hash/:transactionHash', async (req, res, next) => {
  try {
    const { transactionHash } = req.params;
    logger.debug(`searching for block containing transaction hash ${transactionHash}`);

    // get data to return
    const [block] = await getBlockByTransactionHash(transactionHash);

    if (block) {
      const transactions = await getTransactionsByTransactionHashes(block.transactionHashes);
      const index = block.transactionHashes.indexOf(transactionHash);
      delete block?._id; // this is database specific so no need to send it
      res.json({ block, transactions, index });
    } else {
      res.json({ block: null, transactions: null, index: null });
    }
  } catch (err) {
    next(err);
  }
});

router.get('/root/:root', async (req, res, next) => {
  try {
    const { root } = req.params;
    // get data to return
    let block = await getBlockByRoot(root);
    /*
      if we don't get a block, it's possible that the corresponding 'BlockProposed'
      event is still in the event queue, so Nightfall doesn't have it in its database
      yet.  Let's wait for the current queue to empty and try again.
    */
    if (block === null) {
      logger.debug('Block not found, waiting for current queue to process before trying once more');

      await flushQueue(0);
      block = await getBlockByRoot(root);
    }

    if (block !== null) {
      const transactions = await getTransactionsByTransactionHashes(block.transactionHashes);
      delete block?._id; // this is database specific so no need to send it

      res.json({ block, transactions });
    } else {
      res.json({ block: null, transactions: null });
    }
  } catch (err) {
    next(err);
  }
});

router.get('/reset-localblock', async (req, res, next) => {
  try {
    await Block.rollback();
    await resetUnsuccessfulBlockProposedTransactions();
    res.json({ resetstatus: true });
  } catch (err) {
    next(err);
  }
});

export default router;
