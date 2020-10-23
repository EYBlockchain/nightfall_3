import zokrates from '@eyblockchain/zokrates-zexe.js';
import path from 'path';
import rabbitmq from '../utils/rabbitmq.mjs';
import { getProofByCircuitPath } from '../utils/filing.mjs';
import logger from '../utils/logger.mjs';

export default function receiveMessage() {
  const outputPath = `./output/`;

  rabbitmq.receiveMessage('generate-proof', async message => {
    const { replyTo, correlationId } = message.properties;
    const {
      folderpath,
      inputs,
      transactionInputs,
      outputDirectoryPath,
      proofFileName,
      backend = 'zexe',
      provingScheme = 'gm17',
    } = JSON.parse(message.content.toString());

    const response = {
      error: null,
      data: null,
    };

    const circuitName = path.basename(folderpath);

    const opts = {};
    opts.createFile = true;
    opts.directory = `./output/${folderpath}` || outputDirectoryPath;
    opts.fileName = `${circuitName}_proof.json` || proofFileName;

    try {
      logger.info('Compute witness...');
      await zokrates.computeWitness(
        `${outputPath}/${folderpath}/${circuitName}_out`,
        `${outputPath}/${folderpath}/`,
        `${circuitName}_witness`,
        inputs,
      );

      logger.info('Generate proof...');
      await zokrates.generateProof(
        `${outputPath}/${folderpath}/${circuitName}_pk.key`,
        `${outputPath}/${folderpath}/${circuitName}_out`,
        `${outputPath}/${folderpath}/${circuitName}_witness`,
        provingScheme,
        backend,
        opts,
      );

      const { proof, inputs: publicInputs } = await getProofByCircuitPath(folderpath);

      logger.info(`Complete`);
      logger.debug(`Responding with proof and inputs:`);
      logger.debug(proof);
      logger.debug(publicInputs);

      response.data = { proof, inputs: publicInputs, transactionInputs };
    } catch (err) {
      response.error = err;
    }

    rabbitmq.sendMessage(replyTo, response, { correlationId, type: folderpath });
    rabbitmq.sendACK(message);
  });
}
