import express from 'express';
import { verify } from '../zokrates-lib/index.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();
/**

*/
router.post('/', async (req, res, next) => {
  try {
    logger.info(`Received request to /verify`);
    logger.debug('Body', req.body);
    const { vk, proof, provingScheme, backend, curve, inputs } = req.body;
    // sometimes the public inputs are already included in the proof
    let combinedProof;
    if (!proof.inputs) combinedProof = { proof, inputs };
    else combinedProof = proof;
    const verifies = await verify(vk, combinedProof, provingScheme, backend, curve);
    logger.debug(`verify returned ${verifies}`);
    return res.send({ verifies });
  } catch (err) {
    return next(err);
  }
});

export default router;
