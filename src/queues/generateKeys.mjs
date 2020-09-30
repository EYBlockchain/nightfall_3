import fs from 'fs';
import path from 'path';
import zokrates from '@eyblockchain/zokrates-zexe.js';
import rabbitmq from '../utils/rabbitmq.mjs';
import logger from '../utils/logger.mjs';

export default function receiveMessage() {
  const outputPath = `./output`;
  const circuitsPath = `./circuits`;

  rabbitmq.receiveMessage('generate-keys', async message => {
    const { filepath, curve = 'bls12_377', backend = 'zexe', provingScheme = 'gm17' } = JSON.parse(
      message.content.toString(),
    );
    const { replyTo, correlationId } = message.properties;
    const response = {
      error: null,
      data: null,
    };

    try {
      const ext = path.extname(filepath);
      const circuitName = path.basename(filepath, '.zok'); // filename without '.zok'
      const circuitDir = filepath.replace(ext, '');

      fs.mkdirSync(`${outputPath}/${circuitDir}`, { recursive: true });

      logger.info('\nCompile...');
      await zokrates.compile(
        `${circuitsPath}/${filepath}`,
        `${outputPath}/${circuitDir}`,
        `${circuitName}_out`,
        curve,
      );

      logger.info('\nSetup...');
      await zokrates.setup(
        `${outputPath}/${circuitDir}/${circuitName}_out`,
        `${outputPath}/${circuitDir}`,
        provingScheme,
        backend,
        `${circuitName}_vk`,
        `${circuitName}_pk`,
      );

      const vk = await zokrates.extractVk(`${outputPath}/${circuitDir}/${circuitName}_vk.key`);

      logger.info(`\nComplete ${filepath}`);

      response.data = { vk, filepath };
    } catch (err) {
      response.error = err;
    }

    rabbitmq.sendMessage(replyTo, response, { correlationId });
    rabbitmq.sendACK(message);
  });
}
