/* eslint-disable import/no-webpack-loader-syntax, no-await-in-loop */
// ignore unused exports default

/*
 * main thread file
 */

import {
  fetchCircuit,
  fetchAWSfiles,
} from 'comlink-loader?singleton!@Nightfall/services/fetch-circuit';

import {
  checkIndexDBForCircuit,
  checkIndexDBForCircuitHash,
  storeCircuit,
} from '@Nightfall/services/database';

const {
  utilApiServerUrl,
  isLocalRun,
  AWS: { s3Bucket },
} = global.config;

export default async function fetchCircuitFileAndStoreInIndexedDB() {
  const circuitInfo = isLocalRun
    ? await fetch(`${utilApiServerUrl}/s3_hash.txt`).then(response => response.json())
    : JSON.parse(new TextDecoder().decode(await fetchAWSfiles(s3Bucket, 's3_hash.txt')));
  for (const circuit of circuitInfo) {
    if (
      !(await checkIndexDBForCircuit(circuit.name)) ||
      !(await checkIndexDBForCircuitHash(circuit))
    ) {
      console.log('Updating', circuit);
      const { wasm, wasmh, zk, zkh, hash, hashh } = await fetchCircuit(circuit, {
        utilApiServerUrl,
        isLocalRun,
        AWS: { s3Bucket },
      });
      await storeCircuit(`${circuit.name}-wasm`, wasm, wasmh);
      await storeCircuit(`${circuit.name}-zkey`, zk, zkh);
      await storeCircuit(`${circuit.name}-hash`, hash, hashh);
    }
  }
}
