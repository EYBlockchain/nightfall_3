import fs from 'fs';
import util from 'util';
import crypto from 'crypto';
import path from 'path';
import * as snarkjs from 'snarkjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import generateProof from '../utils/rapidsnark.mjs';
import { readJsonFile } from '../utils/filing.mjs';

const unlink = util.promisify(fs.unlink);

const outputPath = `./output`;

export default async ({ folderpath, inputs, transactionInputs }) => {
  let proof;
  let publicInputs;

  // unique hash to name witness and proof.json files
  // to avoid overwrite on concurrent call.
  const fileNamePrefix = crypto.randomBytes(32).toString('hex');
  const circuitName = folderpath;

  const witnessFilePath = `${outputPath}/${circuitName}/${circuitName}_${fileNamePrefix}_witness`;
  if (fs.existsSync(witnessFilePath)) {
    throw Error('Files with same name exist');
  }

  const proofJsonFilePath = `${outputPath}/${circuitName}/${circuitName}_${fileNamePrefix}_proof.json`;
  const publicJsonFilePath = `${outputPath}/${circuitName}/${circuitName}_${fileNamePrefix}_public.json`;

  try {
    logger.debug('Compute witness...');

    const witnessProofPromise = snarkjs.wtns.calculate(
      inputs,
      `${outputPath}/${circuitName}/${circuitName}_js/${circuitName}.wasm`,
      witnessFilePath,
    ).then(() => {
      logger.debug('Generate proof...');

      return generateProof(
        `${outputPath}/${circuitName}/${circuitName}.zkey`,
        witnessFilePath,
        proofJsonFilePath,
        publicJsonFilePath,
      );
    });

    await witnessProofPromise;

    logger.debug('Proof generated!');

    proof = readJsonFile(proofJsonFilePath);
    publicInputs = readJsonFile(publicJsonFilePath);

    logger.debug({
      msg: 'Responding with proof and inputs',
      proof,
      publicInputs,
    });
  } finally {
    try {
      await Promise.all([
        unlink(witnessFilePath),
        unlink(proofJsonFilePath),
        unlink(publicJsonFilePath)
      ]);
    } catch {
      // No files to delete. Do nothing.
    }
  }

  return {
    proof,
    inputs: publicInputs,
    transactionInputs,
    type: circuitName,
  };
};
