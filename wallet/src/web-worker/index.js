/* eslint-disable import/no-webpack-loader-syntax, no-await-in-loop */
// ignore unused exports default

/*
 * main thread file
 */
import fetchCircuit from 'comlink-loader?singleton!../nightfall-browser/services/fetch-circuit';
import { getStoreCircuit, storeCircuit } from '../nightfall-browser/services/database';

const { circuitsAWSFiles } = global.config;

function checkIndexDBForCircuit(circuit) {
  const [abi, program, pkKey] = Object.keys(circuitsAWSFiles[circuit]);
  return Promise.all([
    getStoreCircuit(`${circuit}-${abi}`),
    getStoreCircuit(`${circuit}-${program}`),
    getStoreCircuit(`${circuit}-${pkKey}`),
  ]).then(record => {
    if (record[0] === undefined) return false;
    if (record[1] === undefined) return false;
    if (record[2] === undefined) return false;
    return true;
  });
}

export default async function fetchCircuitFileAndStoreInIndexedDB() {
  for (const circuit in circuitsAWSFiles) {
    if (!(await checkIndexDBForCircuit(circuit))) {
      const { abi, program, pkKey } = await fetchCircuit(circuit, global.config);
      await storeCircuit(`${circuit}-abi`, abi);
      await storeCircuit(`${circuit}-program`, program);
      await storeCircuit(`${circuit}-pkKey`, pkKey);
    }
  }
}
