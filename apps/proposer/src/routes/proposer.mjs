/* eslint-disable import/no-unresolved */

/**
Routes for managing a proposer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import express from 'express';

const router = express.Router();

router.post('/offchain-transaction', async (req, res, next) => {
  const nf3 = req.app.get('nf3');
  const { transaction } = req.body;

  if (!transaction) {
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

router.get('/fee', async (req, res) => {
  const nf3 = req.app.get('nf3');
  const { proposers } = await nf3.getProposers();
  const thisProposer = proposers.filter(p => p.thisAddress === nf3.ethereumAddress);
  res.json({ fee: Number(thisProposer[0].fee) });
});

export default router;
