/**
Route for depositing (minting) a crypto commitment.
This code assumes that the Shield contract already has approval to spend
funds on a zkp deposit
*/
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { getContractAddress } from 'common-files/utils/contract.mjs';

const router = express.Router();

router.get('/:contract', async (req, res, next) => {
  logger.debug('contract-address endpoint received GET');
  const { contract } = req.params;
  try {
    const address = await getContractAddress(contract);
    logger.debug(`returning address ${address.address} for contract ${address.contractName}`);
    res.json(address);
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
