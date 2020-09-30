import express from 'express';
import zokrates from '@eyblockchain/zokrates-zexe.js';
import path from 'path';
import { getProofByCircuitPath } from '../utils/filing.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

const outputPath = `./output`;

router.post('/', async (req, res, next) => {
  req.setTimeout(3600000); // 1 hour
  const {
    folderpath,
    inputs,
    outputDirectoryPath,
    proofFileName,
    backend = 'zexe',
    provingScheme = 'gm17',
  } = req.body;
  logger.info(`Received request to /generateProof`);
  logger.debug(req.body);

  const circuitName = path.basename(folderpath);

  const opts = {};
  opts.createFile = true;
  opts.directory = `./output/${folderpath}` || outputDirectoryPath;
  opts.fileName = `${circuitName}_proof.json` || proofFileName;

  try {
    logger.info('Compute witness...');
    await zokrates.computeWitness(
      `${outputPath}/${folderpath}/${circuitName}_out`,
      `${outputPath}/${folderpath}/`,
      `${circuitName}_witness`,
      inputs,
    );

    logger.info('Generate proof...');
    await zokrates.generateProof(
      `${outputPath}/${folderpath}/${circuitName}_pk.key`,
      `${outputPath}/${folderpath}/${circuitName}_out`,
      `${outputPath}/${folderpath}/${circuitName}_witness`,
      provingScheme,
      backend,
      opts,
    );

    const { proof, inputs: publicInputs } = await getProofByCircuitPath(folderpath);

    logger.info(`Complete`);
    logger.debug(`Responding with proof and inputs:`);
    logger.debug(proof);
    logger.debug(publicInputs);
    return res.send({
      proof,
      inputs: publicInputs,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
