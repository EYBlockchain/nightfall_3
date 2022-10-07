/**
Routes for managing a synchronizer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

const router = express.Router();

router.get('/:contract', async (req, res) => {
  const nf3 = req.app.get('nf3');

  const { contract } = req.params;
  logger.debug(`contract-address endpoint received GET ${contract}`);

  if (!contract) {
    res.sendStatus(404);
    return;
  }
  const address = await nf3.getContractAddressOptimist(contract);
  res.json({ address });
});

export default router;
