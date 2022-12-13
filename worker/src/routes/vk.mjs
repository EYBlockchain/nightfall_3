import express from 'express';
import { getVerificationKeyByCircuitPath } from '../utils/filing.mjs';

const router = express.Router();

/**
 * @param {string} circuitName is the name of the circuit (e.g. myCircuit); note no `.circom` extension.
 */
router.get('/', async (req, res, next) => {
  try {
    const { folderpath } = req.query;
    const vk = await getVerificationKeyByCircuitPath(folderpath);
    return res.send({ vk });
  } catch (err) {
    return next(err);
  }
});

export default router;
