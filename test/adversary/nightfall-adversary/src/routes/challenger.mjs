/**
Routes for setting and removing valid challenger addresses.
*/
import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { addChallengerAddress, removeChallengerAddress } from '../services/database.mjs';

const router = express.Router();

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

export default router;
