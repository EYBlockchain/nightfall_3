import fs from 'fs';
import util from 'util';
import crypto from 'crypto';
import path from 'path';
import * as snarkjs from 'snarkjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import generateProof from '../utils/rapidsnark.mjs';
import { readJsonFile } from '../utils/filing.mjs';

const unlink = util.promisify(fs.unlink);

export default async ({ folderpath, inputs, transactionInputs }) => {
  const outputPath = `./output`;
  let proof;
  let publicInputs;

  // unique hash to name witness and proof.json files
  // to avoid overwrite on concurrent call.
  const fileNamePrefix = crypto.randomBytes(32).toString('hex');

  const circuitName = path.basename(folderpath);
  const witnessFile = `${circuitName}_${fileNamePrefix}_witness`;
  const proofJsonFile = `${circuitName}_${fileNamePrefix}_proof.json`;
  const publicJsonFile = `${circuitName}_${fileNamePrefix}_public.json`;

  if (fs.existsSync(`${outputPath}/${folderpath}/${witnessFile}`)) {
    throw Error('Witness file with same name exists');
  }

  if (fs.existsSync(`${outputPath}/${folderpath}/${proofJsonFile}`)) {
    throw Error('proof.json file with same name exists');
  }

  if (fs.existsSync(`${outputPath}/${folderpath}/${publicJsonFile}`)) {
    throw Error('public.json file with same name exists');
  }
  try {
    logger.debug('Compute witness...');

    await snarkjs.wtns.calculate(
      inputs,
      `${outputPath}/${folderpath}/${circuitName}_js/${circuitName}.wasm`,
      `${outputPath}/${folderpath}/${witnessFile}`,
    );

    logger.debug('Generate proof...');
    await generateProof(
      `${outputPath}/${folderpath}/${circuitName}.zkey`,
      `${outputPath}/${folderpath}/${witnessFile}`,
      `${outputPath}/${folderpath}/${proofJsonFile}`,
      `${outputPath}/${folderpath}/${publicJsonFile}`,
    );

    proof = await readJsonFile(`${outputPath}/${folderpath}/${proofJsonFile}`);
    publicInputs = await readJsonFile(`${outputPath}/${folderpath}/${publicJsonFile}`);

    logger.debug({
      msg: 'Responding with proof and inputs',
      proof,
      publicInputs,
    });
  } finally {
    try {
      await unlink(`${outputPath}/${folderpath}/${witnessFile}`);
      await unlink(`${outputPath}/${folderpath}/${proofJsonFile}`);
      await unlink(`${outputPath}/${folderpath}/${publicJsonFile}`);
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
