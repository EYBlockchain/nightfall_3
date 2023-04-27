/**
 * Route for depositing (minting) a crypto commitment.
 * This code assumes that the Shield contract already has approval to spend
 * funds on a zkp deposit
 */
import express from 'express';
import { getContractAddress } from 'common-files/utils/contract.mjs';

const router = express.Router();

router.get('/:contract', async (req, res, next) => {
  const { contract } = req.params;
  try {
    const address = await getContractAddress(contract);

    res.json({ address });
  } catch (err) {
    next(err);
  }
});

export default router;
