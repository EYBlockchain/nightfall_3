import fs from 'fs';
import util from 'util';
import crypto from 'crypto';
import path from 'path';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { computeWitness } from '../zokrates-lib/index.mjs';
import * as snarkjs from 'snarkjs';

const unlink = util.promisify(fs.unlink);

export default async ({ folderpath, inputs, transactionInputs }) => {
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

  try {
    logger.debug('Compute witness...');
    await computeWitness(
      `${outputPath}/${folderpath}/${circuitName}_out`,
      `${outputPath}/${folderpath}/`,
      `${witnessFile}`,
      inputs,
    );

    logger.debug('Generate proof...');
    const prove = await snarkjs.groth16.prove(
      `${outputPath}/${folderpath}/${circuitName}_pk.zkey`,
      `${outputPath}/${folderpath}/${witnessFile}.wtns`,
    );

    proof = prove.proof;
    publicInputs = prove.publicSignals;

    logger.debug({
      msg: 'Responding with proof and inputs',
      proof: JSON.stringify(proof, null, 2),
      publicInputs,
    });
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
