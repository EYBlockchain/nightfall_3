/**
Route for depositing (minting) a crypto commitment.
This code assumes that the Shield contract already has approval to spend
funds on a zkp deposit
*/
import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { getContractAbi } from '@polygon-nightfall/common-files/utils/contract.mjs';

const router = express.Router();

router.get('/:contract', async (req, res, next) => {
  logger.debug('contract-abi endpoint received GET');
  const { contract } = req.params;
  try {
    const abi = await getContractAbi(contract);
    logger.debug(`returning abi ${abi}`);
    if (abi) {
      res.json({ abi });
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
