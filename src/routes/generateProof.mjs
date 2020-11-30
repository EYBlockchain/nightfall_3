import fs from 'fs';
import util from 'util';
import express from 'express';
import zokrates from '@eyblockchain/zokrates-zexe.js';
import path from 'path';
import { getProofFromFile } from '../utils/filing.mjs';
import logger from '../utils/logger.mjs';

const unlink = util.promisify(fs.unlink);

const router = express.Router();

const outputPath = `./output`;

router.post('/', async (req, res, next) => {
  req.setTimeout(3600000); // 1 hour
  const {
    folderpath,
    inputs,
    transactionInputs,
    outputDirectoryPath,
    proofFileName,
    commitmentHash,
    backend = 'zexe',
    provingScheme = 'gm17',
  } = req.body;

  logger.info(`Received request to /generate-proof`);
  logger.debug(JSON.stringify(req.body, null, 2));

  const circuitName = path.basename(folderpath);

  const witnessFile = commitmentHash
    ? `${circuitName}_${commitmentHash}_witness`
    : `${circuitName}_witness`;

  const proofJsonFile = commitmentHash
    ? `${circuitName}_${commitmentHash}_proof.json`
    : `${circuitName}_proof.json`;


  const opts = {};
  opts.createFile = true;
  opts.directory = outputDirectoryPath || `./output/${folderpath}`;
  opts.fileName = proofFileName || `${proofJsonFile}`;

  try {
    logger.info('Compute witness...');
    await zokrates.computeWitness(
      `${outputPath}/${folderpath}/${circuitName}_out`,
      `${outputPath}/${folderpath}/`,
      `${witnessFile}`,
      inputs,
    );

    logger.info('Generate proof...');
    await zokrates.generateProof(
      `${outputPath}/${folderpath}/${circuitName}_pk.key`,
      `${outputPath}/${folderpath}/${circuitName}_out`,
      `${outputPath}/${folderpath}/${witnessFile}`,
      provingScheme,
      backend,
      opts,
    );

    const { proof, inputs: publicInputs } = await getProofFromFile(`${folderpath}/${proofJsonFile}`);

    logger.info(`Complete`);
    logger.debug(`Responding with proof and inputs:`);
    logger.debug(JSON.stringify(req.body, null, 2));
    logger.debug(publicInputs);
    res.send({
      proof,
      inputs: publicInputs,
      type: folderpath,
      transactionInputs,
    });
  } catch (err) {
    next(err);
  }

  // Delete previous witness/proof files if they exist.
  // Prevents bad inputs from going through anyway.
  try {
    await unlink(`${outputPath}/${folderpath}/${witnessFile}`);
    await unlink(`${outputPath}/${folderpath}/${proofJsonFile}`);
  } catch {
    // Do nothing. It's okay if files don't exist.
  }
});

export default router;
