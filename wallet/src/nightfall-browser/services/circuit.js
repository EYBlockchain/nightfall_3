import axios from 'axios';
import {storeCircuit, getStoreCircuit } from './database';
import { parseData, mergeUint8Array } from '../../utils/lib/file-reader-utils';

const { proposerUrl, circuitsAWSFiles } = global.config;

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

/*
 * download circuits and put them in indexedDB
 */
export async function downloadCircuits() {
  for (const circuit in circuitsAWSFiles) {
    if (await checkIndexDBForCircuit(circuit)) continue;
    let {abi, program, pkKey} = (await axios.get(`${proposerUrl}/browser-circuit/${circuit}`)).data;

    abi = (await axios.get(abi)).data;
    await storeCircuit(`${circuit}-abi`, abi);

    program = await fetch(program)
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);
    await storeCircuit(`${circuit}-program`, program);

    pkKey = await fetch(pkKey)
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);
    await storeCircuit(`${circuit}-pkKey`, pkKey);
  }
}
