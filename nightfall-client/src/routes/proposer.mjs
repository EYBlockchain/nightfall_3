/**
 Route for proposer related enpoints
 */

import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import {
  getMempoolTransactions,
  getTransactionByTransactionHash,
  getProposers,
  getCurrentProposer,
} from '../services/proposer.mjs';

const router = express.Router();

router.get('/mempool', async (req, res, next) => {
  logger.debug(`proposer/mempool endpoint received GET ${JSON.stringify(req.body, null, 2)}`);
  try {
    const mempool = await getMempoolTransactions();
    logger.debug('returning mempool');
    res.json({ result: mempool });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

router.get('/transaction-hash/:transactionHash', async (req, res, next) => {
  logger.debug(
    `proposer/transaction-hash endpoint received GET ${JSON.stringify(req.params, null, 2)}`,
  );
  try {
    const transaction = await getTransactionByTransactionHash(req.params);
    logger.debug('Querying transaction');
    res.json({ transaction });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * Returns the current proposer
 */
router.get('/current-proposer', async (req, res, next) => {
  logger.debug(`list proposals endpoint received GET ${JSON.stringify(req.body, null, 2)}`);
  try {
    const currentProposer = await getCurrentProposer();
    logger.debug('returning current proposer');
    logger.silly(`current proposer is ${JSON.stringify(currentProposer, null, 2)}`);
    res.json({ currentProposer });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

/**
 * Returns a list of the registered proposers
 */
router.get('/proposers', async (req, res, next) => {
  logger.debug(`list proposals endpoint received GET`);
  try {
    const proposers = await getProposers();
    logger.debug(`Returning proposer list of length ${proposers.length}`);
    res.json({ proposers });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
