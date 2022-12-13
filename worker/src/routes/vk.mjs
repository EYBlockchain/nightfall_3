import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { getVerificationKeyByCircuitPath } from '../utils/filing.mjs';

const router = express.Router();

/**
 * @param {string} circuitName is the name of the circuit (e.g. myCircuit); note no `.circom` extension.
 */
router.get('/', async (req, res, next) => {
  try {
    logger.debug(`Received request to /vk ${req.query.folderpath}`);
    const { folderpath } = req.query;
    const vk = await getVerificationKeyByCircuitPath(folderpath);
    logger.debug(`Returning vk ${folderpath}`);
    return res.send({ vk });
  } catch (err) {
    return next(err);
  }
});

export default router;
