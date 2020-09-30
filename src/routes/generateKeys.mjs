import express from 'express';
import fs from 'fs';
import path from 'path';
import zokrates from '@eyblockchain/zokrates-zexe.js';
import logger from '../utils/logger.mjs';

const router = express.Router();

const outputPath = `./output`;
const circuitsPath = `./circuits`;

router.post('/', async (req, res, next) => {
  req.setTimeout(3600000); // 1 hour
  const { filepath, curve = 'bls12_377', backend = 'zexe', provingScheme = 'gm17' } = req.body;
  try {
    const ext = path.extname(filepath);
    const circuitName = path.basename(filepath, '.zok'); // filename without '.zok'
    const circuitDir = filepath.replace(ext, '');

    fs.mkdirSync(`${outputPath}/${circuitDir}`, { recursive: true });

    logger.info('Compile...');
    await zokrates.compile(
      `${circuitsPath}/${filepath}`,
      `${outputPath}/${circuitDir}`,
      `${circuitName}_out`,
      curve,
    );

    logger.info('Setup...');
    await zokrates.setup(
      `${outputPath}/${circuitDir}/${circuitName}_out`,
      `${outputPath}/${circuitDir}`,
      provingScheme,
      backend,
      `${circuitName}_vk`,
      `${circuitName}_pk`,
    );

    const vk = await zokrates.extractVk(`${outputPath}/${circuitDir}/${circuitName}_vk.key`);

    logger.info(`Complete`);

    return res.send({ vk });
  } catch (err) {
    return next(err);
  }
});

export default router;
