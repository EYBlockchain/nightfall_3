import fs from 'fs';
import path from 'path';
import * as snarkjs from 'snarkjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import downloadFile from '@polygon-nightfall/common-files/utils/httputils.mjs';
import { compile, exportKeys } from '../zokrates-lib/index.mjs';

export default async function generateKeys({ filepath, curve = 'bn128' }) {
  const outputPath = `./output`;
  const circuitsPath = `./circuits`;

  const ext = path.extname(filepath);
  const circuitName = path.basename(filepath, '.zok'); // filename without '.zok'
  const circuitDir = filepath.replace(ext, '');

  fs.mkdirSync(`${outputPath}/${circuitDir}`, { recursive: true });

  logger.info({
    msg: 'Compiling circuits...',
    circuitsPath: `${circuitsPath}/${filepath}`,
    outputPath: `${outputPath}/${circuitDir}`,
    circuitName: `${circuitName}`,
    curve,
  });

  await compile(
    `${circuitsPath}/${filepath}`,
    `${outputPath}/${circuitDir}`,
    `${circuitName}`,
    curve,
  );

  if (process.env.MPC) {
    logger.info('Exporting keys...');
    await exportKeys(`${outputPath}/${circuitDir}`, `${circuitName}`);
  } else {
    logger.info('Setup...');

    const r1csInfo = await snarkjs.r1cs.info(`${outputPath}/${circuitDir}/${circuitName}.r1cs`);
    const power = Math.ceil(Math.log2(r1csInfo.nConstraints));

    // Download PowersOfTau from Hermez
    if (!fs.existsSync(`${outputPath}/powersOfTau28_hez_final_${power}.ptau`)) {
      logger.info(`Downloading powersOfTau with power ${power} from Hermez`);
      await downloadFile(
        `https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_${power}.ptau`,
        `${outputPath}/powersOfTau28_hez_final_${power}.ptau`,
      );
    }

    logger.info('Generating keys...');
    await snarkjs.zKey.newZKey(
      `${outputPath}/${circuitDir}/${circuitName}.r1cs`,
      `${outputPath}/powersOfTau28_hez_final_${power}.ptau`,
      `${outputPath}/${circuitDir}/${circuitName}_pk.zkey`,
    );
  }

  const vk = await snarkjs.zKey.exportVerificationKey(
    `${outputPath}/${circuitDir}/${circuitName}_pk.zkey`,
  );

  logger.info('Key generation completed');

  return { vk, filepath };
}
