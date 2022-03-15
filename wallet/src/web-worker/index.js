/*
 * main thread file
 */
import * as Comlink from 'comlink';
import { getStoreCircuit, storeCircuit } from '../nightfall-browser/services/database';
import downloadCircuitWorker from 'worker-loader!./circuit.comlink.worker';

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
    const downloadCircuit = Comlink.wrap(new downloadCircuitWorker());
    const { abi, program, pkKey } = await downloadCircuit(circuit, global.config);
    await storeCircuit(`${circuit}-abi`, abi);
    await storeCircuit(`${circuit}-program`, program);
    await storeCircuit(`${circuit}-pkKey`, pkKey);
  }
}

init();
