import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { verify } from '../zokrates-lib/index.mjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    logger.debug({
      msg: 'Received request to /verify',
      reqBody: req.body,
    });

    const { vk, proof, backend, inputs } = req.body;
    // sometimes the public inputs are already included in the proof
    let combinedProof;
    if (!proof.inputs) combinedProof = { proof, inputs };
    else combinedProof = proof;
    const verifies = await verify(vk, combinedProof, backend);

    logger.debug({
      msg: 'Verify returned',
      verifies,
    });

    return res.send({ verifies });
  } catch (err) {
    return next(err);
  }
});

export default router;
