import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import { getVerificationKeyByCircuitPath } from '../utils/filing.mjs';

const router = express.Router();

/**
 * @param {string} circuitName is the name of the circuit (e.g. myCircuit); note no `.zok` extension.

*/
router.get('/', async (req, res, next) => {
  try {
    logger.info(`Received request to /vk`);
    logger.debug('Query', req.query);
    const { folderpath } = req.query;
    const vk = getVerificationKeyByCircuitPath(folderpath);
    logger.debug('Returning vk:');
    logger.debug(vk);
    return res.send({ vk });
  } catch (err) {
    return next(err);
  }
});

export default router;
