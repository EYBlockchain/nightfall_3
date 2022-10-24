import express from 'express';
import logger from 'common-files/utils/logger.mjs';
import * as snarkjs from 'snarkjs';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    logger.debug({
      msg: 'Received request to /verify',
      reqBody: req.body,
    });
    const { vk, proof, publicSignals } = req.body;
    // sometimes the public inputs are already included in the proof

    const verifies = await snarkjs.groth16.verify(vk, proof, publicSignals);
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
