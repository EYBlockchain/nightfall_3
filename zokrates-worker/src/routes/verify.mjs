import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { verify } from '../zokrates-lib/index.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { vk, proof, backend, inputs } = req.body;
    // sometimes the public inputs are already included in the proof
    let combinedProof;
    if (!proof.inputs) combinedProof = { proof, inputs };
    else combinedProof = proof;
    const verifies = await verify(vk, combinedProof, backend);

    return res.send({ verifies });
  } catch (err) {
    return next(err);
  }
});

export default router;
