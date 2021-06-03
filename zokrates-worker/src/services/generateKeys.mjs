import fs from 'fs';
import path from 'path';
import { compile, setup, extractVk } from '../zokrates-lib/index.mjs';
import rabbitmq from '../utils/rabbitmq.mjs';
import logger from '../utils/logger.mjs';

export default async function generateKeys({
  filepath,
  curve = 'bls12_377',
  backend = 'ark',
  provingScheme = 'gm17',
}) {
  const outputPath = `./output`;
  const circuitsPath = `./circuits`;

  const ext = path.extname(filepath);
  const circuitName = path.basename(filepath, '.zok'); // filename without '.zok'
  const circuitDir = filepath.replace(ext, '');

  fs.mkdirSync(`${outputPath}/${circuitDir}`, { recursive: true });

  logger.debug(
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

  logger.info('Setup...');
  await setup(
    `${outputPath}/${circuitDir}/${circuitName}_out`,
    `${outputPath}/${circuitDir}`,
    provingScheme,
    backend,
    `${circuitName}_vk`,
    `${circuitName}_pk`,
  );

  const vk = await extractVk(`${outputPath}/${circuitDir}/${circuitName}_vk.key`);

  logger.info(`Complete ${filepath}`);
  return { vk, filepath };
}
