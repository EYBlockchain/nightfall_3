/* eslint-disable import/no-unresolved */

/**
Routes for managing a proposer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import { nextTick } from 'async';
import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

const router = express.Router();

router.get('/:contract', async (req, res, next) => {
  const nf3 = req.app.get('nf3');

  const { contract } = req.params;
  if (!contract) {
    res.sendStatus(404);
    return;
  }

  try {
    const address = await nf3.getContractAddressOptimist(contract);
    res.json({ address });
  } catch(error) {
    next(error);
  }
});

export default router;
