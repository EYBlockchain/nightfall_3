/**
Routes for managing a proposer.
Some transactions are so simple that, we don't split out a separate service
module but handle the entire request here.
*/
import express from 'express';
import { nf3GetContractAddressOptimist } from '../nf3-wrapper.mjs';

const router = express.Router();

router.get('/:contract', async (req, res) => {
  const { contract } = req.params;
  console.log(`contract-address endpoint received GET ${contract}`);

  if (!contract) {
    res.sendStatus(404);
    return;
  }
  const address = await nf3GetContractAddressOptimist(contract);
  res.json({ address });
});

export default router;
