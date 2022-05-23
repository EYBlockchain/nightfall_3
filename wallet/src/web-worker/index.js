/* eslint-disable import/no-webpack-loader-syntax, no-await-in-loop */
// ignore unused exports default

/*
 * main thread file
 */
import { wrap } from 'comlink';
import { checkIndexDBForCircuit, storeCircuit } from '../nightfall-browser/services/database';
import fetchCircuitWorker from './fetch-circuit.worker';

const fetchCircuit = wrap(fetchCircuitWorker());

const {
  circuitsAWSFiles,
  USE_STUBS,
  utilApiServerUrl,
  isLocalRun,
  AWS: { s3Url },
} = global.config;

export default async function fetchCircuitFileAndStoreInIndexedDB() {
  for (const circuit in circuitsAWSFiles) {
    if (
      (!USE_STUBS && circuit.slice(-4) !== 'stub') ||
      (USE_STUBS && circuit.slice(-4) === 'stub')
    ) {
      if (!(await checkIndexDBForCircuit(circuit))) {
        const { abi, program, pk } = await fetchCircuit(circuit, {
          utilApiServerUrl,
          isLocalRun,
          circuitsAWSFiles,
          s3Url,
        });
        await storeCircuit(`${circuit}-abi`, abi);
        await storeCircuit(`${circuit}-program`, program);
        await storeCircuit(`${circuit}-pk`, pk);
      }
    }
  }
}
