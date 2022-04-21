/* eslint-disable import/no-webpack-loader-syntax, no-await-in-loop */
// ignore unused exports default

/*
 * main thread file
 */
import fetchCircuit from 'comlink-loader?singleton!../nightfall-browser/services/fetch-circuit';
import { checkIndexDBForCircuit, storeCircuit } from '../nightfall-browser/services/database';

const { circuitsAWSFiles, USE_STUBS } = global.config;

export default async function fetchCircuitFileAndStoreInIndexedDB() {
  for (const circuit in circuitsAWSFiles) {
    if (
      (!USE_STUBS && circuit.slice(-4) !== 'stub') ||
      (USE_STUBS && circuit.slice(-4) === 'stub')
    ) {
      if (!(await checkIndexDBForCircuit(circuit))) {
        const { abi, program, pk } = await fetchCircuit(circuit, global.config);
        await storeCircuit(`${circuit}-abi`, abi);
        await storeCircuit(`${circuit}-program`, program);
        await storeCircuit(`${circuit}-pk`, pk);
      }
    }
  }
}
