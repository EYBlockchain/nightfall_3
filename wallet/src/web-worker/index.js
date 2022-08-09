/* eslint-disable import/no-webpack-loader-syntax, no-await-in-loop */
// ignore unused exports default

/*
 * main thread file
 */
import {
  fetchCircuit,
  fetchAWSfiles,
} from 'comlink-loader?singleton!@Nightfall/services/fetch-circuit';
import { checkIndexDBForCircuit, storeCircuit } from '@Nightfall/services/database';

const {
  utilApiServerUrl,
  isLocalRun,
  AWS: { s3Bucket },
} = global.config;

export default async function fetchCircuitFileAndStoreInIndexedDB() {
  const circuitInfo = JSON.parse(
    new TextDecoder().decode(await fetchAWSfiles(s3Bucket, 's3_hash.txt')),
  );
  for (const circuit in circuitInfo) {
    if (!(await checkIndexDBForCircuit(circuit))) {
      const { abi, abih, program, programh, pk, pkh } = await fetchCircuit(circuit, {
        utilApiServerUrl,
        isLocalRun,
        AWS: { s3Bucket },
      });
      await storeCircuit(`${circuit}-abi`, abi, abih);
      await storeCircuit(`${circuit}-program`, program, programh);
      await storeCircuit(`${circuit}-pk`, pk, pkh);
    }
  }
}
