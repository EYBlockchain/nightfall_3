/**
 Route for interacting with connected peers/proposers
 */

import express from 'express';
import logger from '../utils/logger.mjs';
import { savePeers, retrievePeers } from '../services/peers.mjs';

const router = express.Router();

// peer object : {address: string, enode: string}

router.post('/addPeers', async (req, res, next) => {
  logger.debug(`addPeers endpoint received POST ${JSON.stringify(req.body, null, 2)}`);
  try {
    const peers = Array.isArray(req.body)
      ? req.body.map(p => {
          return { address: p.address, enode: p.enode };
        })
      : [{ address: req.body.address, enode: req.body.enode }];
    await savePeers(peers);
    logger.debug('saving peers');
    res.sendStatus(200);
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  logger.debug('peers endpoint received GET');
  try {
    const peers = await retrievePeers();
    logger.debug(`returning list of peers ${peers}`);
    res.json({ peers });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
