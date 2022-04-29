/* eslint-disable import/no-webpack-loader-syntax, no-await-in-loop */
// ignore unused exports default

/*
 * main thread file
 */
import fetchCircuit from 'comlink-loader?singleton!@Nightfall/services/fetch-circuit';
import { checkIndexDBForCircuit, storeCircuit } from '@Nightfall/services/database';

const { circuitsAWSFiles, USE_STUBS, utilApiServerUrl, isLocalRun, AWS : { s3Bucket} } = global.config;

export default async function fetchCircuitFileAndStoreInIndexedDB() {
  for (const circuit in circuitsAWSFiles) {
    if (
      (!USE_STUBS && circuit.slice(-4) !== 'stub') ||
      (USE_STUBS && circuit.slice(-4) === 'stub')
    ) {
      if (!(await checkIndexDBForCircuit(circuit))) {
        const { abi, program, pk } = await fetchCircuit(circuit, { utilApiServerUrl, isLocalRun, circuitsAWSFiles, AWS: { s3Bucket } });
        await storeCircuit(`${circuit}-abi`, abi);
        await storeCircuit(`${circuit}-program`, program);
        await storeCircuit(`${circuit}-pk`, pk);
      }
    }
  }
}
