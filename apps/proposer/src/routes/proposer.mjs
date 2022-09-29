/* eslint-disable import/no-unresolved */

/**
Routes for managing a proposer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import express from 'express';
import { getCurrentProposer, registerProposer } from '../services/proposer.mjs';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const currentProposer = await getCurrentProposer();
    return res.json(currentProposer.data);
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  const keys = req.app.get('keys');
  try {
    await registerProposer(keys);
    return res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {});

router.delete('/', async (req, res, next) => {});

router.get('/bond', async (req, res, next) => {});

router.get('/change', async (req, res, next) => {});

router.get('/:id', async (req, res, next) => {});

router.get('/current', async (req, res, next) => {});

router.get('/all', async (req, res, next) => {});

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
