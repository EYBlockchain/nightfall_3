/**
Routes for setting and removing valid challenger addresses.
*/
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import config from 'config';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import { addChallengerAddress, removeChallengerAddress } from '../services/database.mjs';

const router = express.Router();
const { STATE_CONTRACT_NAME } = config;

router.post('/add', async (req, res, next) => {
  logger.debug('add endpoint received POST');
  try {
    const { address } = req.body;
    const result = await addChallengerAddress(address);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/remove', async (req, res, next) => {
  logger.debug('remove endpoint received post');
  try {
    const { address } = req.body;
    res.json(await removeChallengerAddress(address));
  } catch (err) {
    next(err);
  }
});

router.get('/checkEarnings', async (req, res, next) => {
  logger.debug('check challenger earnings get');
  try {
    const { address } = req.query;
    const stateContractInstance = await getContractInstance(STATE_CONTRACT_NAME);
    const amount = await stateContractInstance.methods.pendingWithdrawals(address).call();

    logger.debug(`returning pending earnings ${amount}`);
    res.json({ amount });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

router.post('/withdrawEarnings', async (req, res, next) => {
  logger.debug('withdraw challenger earnings post');
  try {
    const stateContractInstance = await getContractInstance(STATE_CONTRACT_NAME);
    const txDataToSign = await stateContractInstance.methods.withdraw().encodeABI();

    logger.debug(`returning withdraw transaction ${txDataToSign}`);
    res.json({ txDataToSign });
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

export default router;
