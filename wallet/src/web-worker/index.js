/* eslint-disable import/no-webpack-loader-syntax, no-await-in-loop */
// ignore unused exports default

/*
 * main thread file
 */
import fetchCircuit from 'comlink-loader?singleton!@Nightfall/services/fetch-circuit';
import { checkIndexDBForCircuit, storeCircuit } from '@Nightfall/services/database';

const {
  utilApiServerUrl,
  isLocalRun,
  AWS: { s3Bucket, circuitFiles },
} = global.config;

export default async function fetchCircuitFileAndStoreInIndexedDB() {
  for (const circuit in circuitFiles) {
    if (!(await checkIndexDBForCircuit(circuit))) {
      const { abi, program, pk } = await fetchCircuit(circuit, {
        utilApiServerUrl,
        isLocalRun,
        AWS: { s3Bucket, circuitFiles },
      });
      await storeCircuit(`${circuit}-abi`, abi);
      await storeCircuit(`${circuit}-program`, program);
      await storeCircuit(`${circuit}-pk`, pk);
    }
  }
}
