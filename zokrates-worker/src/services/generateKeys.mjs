import fs from 'fs';
import path from 'path';
import {
  compile,
  extractVk,
  ceremony,
  beacon,
  exportKeys,
  contribution,
} from '../zokrates-lib/index.mjs';
import logger from '../utils/logger.mjs';

export default async function generateKeys({ filepath, curve = 'bn128' }) {
  const outputPath = `./output`;
  const circuitsPath = `./circuits`;

  const ext = path.extname(filepath);
  const circuitName = path.basename(filepath, '.zok'); // filename without '.zok'
  const circuitDir = filepath.replace(ext, '');

  fs.mkdirSync(`${outputPath}/${circuitDir}`, { recursive: true });

  logger.info(
    `${circuitsPath}/${filepath}`,
    `${outputPath}/${circuitDir}`,
    `${circuitName}_out`,
    curve,
  );

  logger.info('Compile...');
  await compile(
    `${circuitsPath}/${filepath}`,
    `${outputPath}/${circuitDir}`,
    `${circuitName}_out`,
    curve,
  );

  logger.info('MPC Ceremony...');
  await ceremony(`${outputPath}/${circuitDir}`, `${circuitName}`, { verbose: true });

  // magic number is the max int for randomInt
  let randomness = crypto.randomInt(281474976710655);
  logger.info('Contributing...');
  await contribution(randomness);

  randomness = crypto.randomInt(281474976710655);
  const hash = crypto.createHash('sha256').update(randomness.toString()).digest('hex');
  logger.info('MPC Beacon...');
  await beacon(hash, { verbose: true });

  logger.info('Export keys...');
  await exportKeys(`${outputPath}/${circuitDir}`, `${circuitName}`);

  const vk = await extractVk(`${outputPath}/${circuitDir}/${circuitName}_vk.key`);

  logger.info(`Complete ${filepath}`);
  return { vk, filepath };
}
