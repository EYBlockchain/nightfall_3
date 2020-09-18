import zokrates from '@eyblockchain/zokrates-zexe.js';
import path from 'path';

import rabbitmq from '../utils/rabbitmq.mjs';
import { getProofByCircuitPath } from '../utils/filing.mjs';

export default function receiveMessage() {
  const outputPath = `./output/`;

  rabbitmq.receiveMessage('generate-proof', async message => {
    const { replyTo, correlationId } = message.properties;
    const {
      folderpath,
      inputs,
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
      console.log('\nCompute witness...');
      await zokrates.computeWitness(
        `${outputPath}/${folderpath}/${circuitName}_out`,
        `${outputPath}/${folderpath}/`,
        `${circuitName}_witness`,
        inputs,
      );

      console.log('\nGenerate proof...');
      await zokrates.generateProof(
        `${outputPath}/${folderpath}/${circuitName}_pk.key`,
        `${outputPath}/${folderpath}/${circuitName}_out`,
        `${outputPath}/${folderpath}/${circuitName}_witness`,
        provingScheme,
        backend,
        opts,
      );

      const { proof, inputs: publicInputs } = await getProofByCircuitPath(folderpath);

      console.log(`\nComplete`);
      console.log(`\nResponding with proof and inputs:`);
      console.log(proof);
      console.log(publicInputs);

      response.data = { proof, inputs: publicInputs };
    } catch (err) {
      response.error = err;
    }

    rabbitmq.sendMessage(replyTo, response, { correlationId });
    rabbitmq.sendACK(message);
  });
}
