import fs from 'fs';
import util from 'util';
import zokrates from '@eyblockchain/zokrates-zexe.js';
import path from 'path';
import { getProofFromFile } from '../utils/filing.mjs';
import logger from '../utils/logger.mjs';

const unlink = util.promisify(fs.unlink);

export default async function ({
  folderpath,
  inputs,
  transactionInputs,
  outputDirectoryPath,
  proofFileName,
  commitmentHash,
  backend = 'zexe',
  provingScheme = 'gm17',
}) {
  const outputPath = `./output`;

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
  logger.debug(proof);
  logger.debug(publicInputs);

  try {
    await unlink(`${outputPath}/${folderpath}/${witnessFile}`);
    await unlink(`${outputPath}/${folderpath}/${proofJsonFile}`);
  } catch {
    // No files to delete. Do nothing.
  }

  return {
    proof,
    inputs: publicInputs,
    transactionInputs,
    type: folderpath,
  };
}
