/* eslint-disable import/no-unresolved */

/**
Routes for managing a proposer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import express from 'express';
import {
  getCurrentProposer,
  getProposers,
  registerProposer,
  updateProposer,
  unregisterProposer,
  changeCurrentProposer,
  withdrawBond,
} from '../services/proposer.mjs';

const router = express.Router();

/**
 * TODO this currently matches two paths (+ another one with the query) since there is some functionality
 * lacking on optimist itself, but we should have these three routes planned
 * */
router.get(['/', '/current'], async (req, res, next) => {
  try {
    const { id } = req.query;

    const proposer = id ? await getCurrentProposer() : await getCurrentProposer();
    return res.json(proposer);
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { bond } = req.body;
    await registerProposer(bond);
    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const { url } = req.body;
    await updateProposer(url);
    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    await unregisterProposer();
    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
});

router.get('/all', async (req, res, next) => {
  try {
    const proposers = await getProposers();
    return res.json(proposers);
  } catch (error) {
    return next(error);
  }
});

router.put('/change', async (req, res, next) => {
  try {
    await changeCurrentProposer();
    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
});

router.post('/bond', async (req, res, next) => {
  try {
    await withdrawBond();
    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
});

// router.post('/offchain-transaction', async (req, res) => {
//   const nf3 = req.app.get('nf3');
//   logger.debug(`Proposer/offchain-transaction endpoint received POST`);
//   logger.debug(`With content ${JSON.stringify(req.body, null, 2)}`);
//   const { transaction } = req.body;

//   if (!transaction) {
//     res.sendStatus(404);
//     return;
//   }
//   await nf3.sendOffchainTransaction(transaction);
//   res.sendStatus(200);
// });

// router.get('/mempool', async (req, res) => {
//   const nf3 = req.app.get('nf3');
//   logger.debug(`Proposer/mempool endpoint received POST`);
//   logger.debug(`With content ${JSON.stringify(req.body, null, 2)}`);
//   const mempoolTransactions = await nf3.getMempoolTransactions();
//   res.json({ mempoolTransactions });
// });

export default router;
