/**
Route for depositing (minting) a crypto commitment.
This code assumes that the Shield contract already has approval to spend
funds on a zkp deposit
*/
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';

const router = express.Router();

router.get('/:contract', async (req, res) => {
  logger.debug('contract-version endpoint received GET');
  const { contract } = req.params;
  const contractInstance = await waitForContract(contract);
  try {
    const version = await contractInstance.methods.version().call();
    res.json({ version });
  } catch (err) {
    logger.error(err.message);
    res.sendStatus(404);
  }
});

export default router;
