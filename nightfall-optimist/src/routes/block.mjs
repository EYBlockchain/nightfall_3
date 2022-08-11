/**
Routes for checking that a block is valid.
*/
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { flushQueue } from 'common-files/utils/event-queue.mjs';
import checkBlock from '../services/check-block.mjs';
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
  logger.debug('block endpoint received POST');
  try {
    const { block, transactions } = req.body;
    const result = await checkBlock(block, transactions);
    logger.debug(`Result of block check was ${JSON.stringify(result, null, 2)}`);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/make-now', async (req, res, next) => {
  logger.debug('make-now endpoint received GET');
  try {
    setMakeNow();
    res.send('Making short block');
  } catch (err) {
    next(err);
  }
});

router.get('/transaction-hash/:transactionHash', async (req, res, next) => {
  logger.debug('block endpoint received get');
  try {
    const { transactionHash } = req.params;
    logger.debug(`searching for block containing transaction hash ${transactionHash}`);
    // get data to return
    const [block] = await getBlockByTransactionHash(transactionHash);
    if (block) {
      const transactions = await getTransactionsByTransactionHashes(block.transactionHashes);
      const index = block.transactionHashes.indexOf(transactionHash);
      delete block?._id; // this is database specific so no need to send it
      logger.debug(`Found block ${JSON.stringify(block, null, 2)} in database`);
      res.json({ block, transactions, index });
    } else {
      logger.debug('Block not found');
      res.json({ block: null, transactions: null, index: null });
    }
  } catch (err) {
    next(err);
  }
});

router.get('/root/:root', async (req, res, next) => {
  logger.debug('block /root endpoint received get');
  try {
    const { root } = req.params;
    logger.debug(`searching for block containing root ${root}`);
    // get data to return
    let block = await getBlockByRoot(root);
    // if we don't get a block, it's possible that the corresponding 'BlockProposed'
    // event is still in the event queue, so Nightfall doesn't have it in its database
    // yet.  Let's wait for the current queue to empty and try again.
    if (block === null) {
      logger.debug('Block not found, waiting for current queue to process before trying once more');
      await flushQueue(0);
      block = await getBlockByRoot(root);
    }
    if (block !== null) {
      const transactions = await getTransactionsByTransactionHashes(block.transactionHashes);
      delete block?._id; // this is database specific so no need to send it
      logger.debug(`Found block ${JSON.stringify(block, null, 2)} in database`);
      res.json({ block, transactions });
    } else {
      logger.debug('Block not found');
      res.json({ block: null, transactions: null });
    }
  } catch (err) {
    next(err);
  }
});

router.get('/reset-localblock', async (req, res, next) => {
  logger.debug('block endpoint received get');
  try {
    await Block.rollback();
    await resetUnsuccessfulBlockProposedTransactions();
    res.json({ resetstatus: true });
  } catch (err) {
    next(err);
  }
});

export default router;
