/* eslint-disable import/no-unresolved */

import express from 'express';
import {
  getCurrentProposer,
  getProposers,
  registerProposer,
  updateProposer,
  unregisterProposer,
  changeCurrentProposer,
  withdrawStake,
} from '../services/proposer.mjs';
import { address } from '../classes/web3.mjs';

const router = express.Router();

router.get(['/'], async (req, res, next) => {
  try {
    const proposer = { address };
    return res.json(proposer);
  } catch (error) {
    return next(error);
  }
});

/**
 * TODO please leave commented since this feature will be implemented at some point
 * */
// router.get('/:id', async (req, res, next) => {
//   try {
//     const { id } = req.query;

//     const proposer = await getCurrentProposer();

//     return res.json(proposer);
//   } catch (error) {
//     return next(error);
//   }
// });

router.get('/current', async (req, res, next) => {
  try {
    const proposer = await getCurrentProposer();

    return res.json(proposer);
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { bond, url } = req.body;
    await registerProposer(bond, url);
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

router.put('/stake', async (req, res, next) => {
  try {
    const { url, stake } = req.body;
    await updateProposer(url, stake);
    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
});

router.delete('/stake', async (req, res, next) => {
  try {
    await withdrawStake();
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
