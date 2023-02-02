/* eslint-disable import/no-unresolved */

/**
Routes for managing a proposer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import express from 'express';
import config from 'config';

const { MAX_BLOCK_SIZE, MINIMUM_TRANSACTION_SLOTS } = config;

const router = express.Router();

router.post('/offchain-transaction', async (req, res, next) => {
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
    res.sendStatus(404);
    return;
  }

  try {
    await nf3.sendOffchainTransaction(transaction);
    res.sendStatus(200);
  } catch (error) {
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
    const optimistRes = await nf3.requestMempoolTransactionByL2TransactionHash(l2TransactionHash);
    res.json(optimistRes.data);
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
