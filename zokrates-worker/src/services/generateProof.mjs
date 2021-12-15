import fs from 'fs';
import util from 'util';
import crypto from 'crypto';
import path from 'path';
import { computeWitness, generateProof } from '../zokrates-lib/index.mjs';
import { getProofFromFile } from '../utils/filing.mjs';
import logger from '../utils/logger.mjs';

const unlink = util.promisify(fs.unlink);

export default async ({
  folderpath,
  inputs,
  transactionInputs,
  outputDirectoryPath,
  proofFileName,
  backend = 'bellman',
  provingScheme = 'g16',
}) => {
  const outputPath = `./output`;
  let proof;
  let publicInputs;

  // unique hash to name witness and proof.json files
  // to avoid overwrite on concurrent call.
  const fileNamePrefix = (await crypto.randomBytes(32)).toString('hex');

  const circuitName = path.basename(folderpath);
  const witnessFile = `${circuitName}_${fileNamePrefix}_witness`;
  const proofJsonFile = `${circuitName}_${fileNamePrefix}_proof.json`;

  if (fs.existsSync(`${outputPath}/${folderpath}/${witnessFile}`)) {
    throw Error('Witness file with same name exists');
  }

  if (fs.existsSync(`${outputPath}/${folderpath}/${proofJsonFile}`)) {
    throw Error('proof.json file with same name exists');
  }

  const opts = {};
  opts.createFile = true;
  opts.directory = outputDirectoryPath || `./output/${folderpath}`;
  opts.fileName = proofFileName || `${proofJsonFile}`;

  try {
    logger.info('Compute witness...');
    await computeWitness(
      `${outputPath}/${folderpath}/${circuitName}_out`,
      `${outputPath}/${folderpath}/`,
      `${witnessFile}`,
      inputs,
    );

    logger.info('Generate proof...');
    await generateProof(
      `${outputPath}/${folderpath}/${circuitName}_pk.key`,
      `${outputPath}/${folderpath}/${circuitName}_out`,
      `${outputPath}/${folderpath}/${witnessFile}`,
      provingScheme,
      backend,
      opts,
    );

    ({ proof, inputs: publicInputs } = await getProofFromFile(`${folderpath}/${proofJsonFile}`));

    logger.info(`Complete`);
    logger.debug(`Responding with proof and inputs:`);
    logger.debug(`${JSON.stringify(proof, null, 2)}`);
    logger.debug(publicInputs);
  } finally {
    try {
      await unlink(`${outputPath}/${folderpath}/${witnessFile}`);
      await unlink(`${outputPath}/${folderpath}/${proofJsonFile}`);
    } catch {
      // No files to delete. Do nothing.
    }
  }

  return {
    proof,
    inputs: publicInputs,
    transactionInputs,
    type: folderpath,
  };
};
