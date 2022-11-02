import express from 'express';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import getCircuitHash from '../services/getCircuitHash.mjs';

const router = express.Router();

router.get('/', async (req, res, next) => {
  req.setTimeout(3600000); // 1 hour
  try {
    logger.debug({ msg: 'Received request to /get-circuit-hash', query: req.query });
    const { circuit } = req.query;
    const circuitHash = await getCircuitHash(circuit);

    logger.debug({ msg: 'Returning circuit hash', circuitHash });

    return res.send(circuitHash);
  } catch (err) {
    return next(err);
  }
});

export default router;
