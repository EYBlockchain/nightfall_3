/**
Route for depositing (minting) a crypto commitment.
This code assumes that the Shield contract already has approval to spend
funds on a zkp deposit
*/
import express from 'express';
import {
  getContractAbi,
  clearCachedContracts,
} from '@polygon-nightfall/common-files/utils/contract.mjs';

const router = express.Router();

router.get('/:contract', async (req, res, next) => {
  const { contract } = req.params;
  try {
    const abi = await getContractAbi(contract);
    if (abi) {
      res.json({ abi });
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    next(err);
  }
});

router.get('/clear', async (req, res, next) => {
  try {
    await clearCachedContracts();
    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
});

export default router;
