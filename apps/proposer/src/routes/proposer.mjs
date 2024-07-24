/* eslint-disable import/no-unresolved */

/**
Routes for managing a proposer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import express from 'express';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';

const { MAX_BLOCK_SIZE, MINIMUM_TRANSACTION_SLOTS } = config;

const router = express.Router();

router.post('/offchain-transaction', async (req, res, next) => {
  logger.info('Starting execution of /offchain-transaction', req?.body);
  const nf3 = req.app.get('nf3');
  const { transaction } = req.body;
  if (!transaction) {
    res.sendStatus(404);
    return;
  }

  // Check that the transaction doesn't exceed the maximum bytes allowed
  const txBytes =
    (MINIMUM_TRANSACTION_SLOTS +
      transaction.nullifiers.length +
      Math.ceil(transaction.historicRootBlockNumberL2.length / 4) +
      transaction.commitments.length) *
    32;

  if (txBytes > MAX_BLOCK_SIZE) {
    logger.error(`Block size limit exceeded: ${txBytes}`);
    res.sendStatus(404);
    return;
  }

  logger.info('Forwarding to optimist');
  try {
    const res2 = await nf3.forwardOffchainTransaction(transaction);
    res.sendStatus(res2.status);
  } catch (error) {
    logger.error('Error when forwarding off-chain tx to optimist');
    logger.error(error);
    next(error);
  }
});

router.get('/mempool', async (req, res, next) => {
  const nf3 = req.app.get('nf3');

  try {
    const mempoolTransactions = await nf3.getMempoolTransactions();
    res.json({ mempoolTransactions });
  } catch (error) {
    next(error);
  }
});

router.get('/mempool/:l2TransactionHash', async (req, res, next) => {
  const nf3 = req.app.get('nf3');
  const { l2TransactionHash } = req.params;

  try {
    const { data } = await nf3.requestMempoolTransactionByL2TransactionHash(l2TransactionHash);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/fee', async (req, res) => {
  const nf3 = req.app.get('nf3');
  const { proposers } = await nf3.getProposers();
  const thisProposer = proposers.filter(p => p.thisAddress === nf3.ethereumAddress);
  res.json({ fee: Number(thisProposer[0].fee) });
});

export default router;
