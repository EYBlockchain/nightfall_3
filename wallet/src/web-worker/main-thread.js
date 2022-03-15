/*
 * main thread file
 */
import { getStoreCircuit, storeCircuit } from '../nightfall-browser/services/database';
import fetchCircuit from 'comlink-loader?singleton!../nightfall-browser/services/fetch-circuit';

const { circuitsAWSFiles } = global.config;

function checkIndexDBForCircuit(circuit) {
  const [abi, program, pkKey] = Object.keys(circuitsAWSFiles[circuit]);
  return Promise.all([
    getStoreCircuit(`${circuit}-${abi}`),
    getStoreCircuit(`${circuit}-${program}`),
    getStoreCircuit(`${circuit}-${pkKey}`),
  ])
  .then(record => {
    if (record[0] === undefined) return false;
    if (record[1] === undefined) return false;
    if (record[2] === undefined) return false;
    return true;
  });
}

async function init() {
  for (const circuit in circuitsAWSFiles) {
    if (await checkIndexDBForCircuit(circuit)) continue;
    const { abi, program, pkKey } = await fetchCircuit(circuit, global.config);
    await storeCircuit(`${circuit}-abi`, abi);
    await storeCircuit(`${circuit}-program`, program);
    await storeCircuit(`${circuit}-pkKey`, pkKey);
  }
}

init();
