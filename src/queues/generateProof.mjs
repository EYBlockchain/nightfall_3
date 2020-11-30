import fs from 'fs';
import util from 'util';
import zokrates from '@eyblockchain/zokrates-zexe.js';
import path from 'path';
import rabbitmq from '../utils/rabbitmq.mjs';
import { getProofFromFile } from '../utils/filing.mjs';
import logger from '../utils/logger.mjs';

const unlink = util.promisify(fs.unlink);

export default function receiveMessage() {
  const outputPath = `./output`;

  rabbitmq.receiveMessage('generate-proof', async message => {
    const { replyTo, correlationId } = message.properties;
    const {
      folderpath,
      inputs,
      transactionInputs,
      outputDirectoryPath,
      proofFileName,
      commitmentHash,
      backend = 'zexe',
      provingScheme = 'gm17',
    } = JSON.parse(message.content.toString());

    const response = {
      error: null,
      data: null,
    };

    const circuitName = path.basename(folderpath);

    const witnessFile = commitmentHash
      ? `${circuitName}_${commitmentHash}_witness`
      : `${circuitName}_witness`;

    const proofJsonFile = commitmentHash
      ? `${circuitName}_${commitmentHash}_proof.json`
      : `${circuitName}_proof.json`;

    const opts = {};
    opts.createFile = true;
    opts.directory = outputDirectoryPath || `./output/${folderpath}`;
    opts.fileName = proofFileName || `${proofJsonFile}`;

    try {
      logger.info('Compute witness...');
      await zokrates.computeWitness(
        `${outputPath}/${folderpath}/${circuitName}_out`,
        `${outputPath}/${folderpath}/`,
        `${witnessFile}`,
        inputs,
      );

      logger.info('Generate proof...');
      await zokrates.generateProof(
        `${outputPath}/${folderpath}/${circuitName}_pk.key`,
        `${outputPath}/${folderpath}/${circuitName}_out`,
        `${outputPath}/${folderpath}/${witnessFile}`,
        provingScheme,
        backend,
        opts,
      );

      const { proof, inputs: publicInputs } = await getProofFromFile(`${folderpath}/${proofJsonFile}`);

      logger.info(`Complete`);
      logger.debug(`Responding with proof and inputs:`);
      logger.debug(proof);
      logger.debug(publicInputs);

      response.data = { proof, inputs: publicInputs, transactionInputs };
    } catch (err) {
      response.error = 'Proof generation failed';
    }

    // Delete previous witness/proof files if they exist.
    // Prevents bad inputs from going through anyway.
    try {
      await unlink(`${outputPath}/${folderpath}/${witnessFile}`);
      await unlink(`${outputPath}/${folderpath}/${proofJsonFile}`);
    } catch {
      // No files to delete. Do nothing.
    }

    rabbitmq.sendMessage(replyTo, response, { correlationId, type: folderpath });
    rabbitmq.sendACK(message);
  });
}
