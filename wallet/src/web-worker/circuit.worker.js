/*
 * worker file to download circuits files from AWS (a worker thread).
 */

import axios from 'axios';

import { parseData, mergeUint8Array } from '../utils/lib/file-reader-utils';

export default async function downloadCircuit(circuit, { proposerUrl }) {
  console.log('in worker thread', circuit);
  let {abi, program, pkKey} = (await axios.get(`${proposerUrl}/browser-circuit/${circuit}`)).data;
  abi = (await axios.get(abi)).data;
  console.log(circuit, ' abi fetched ');
  program = await fetch(program)
    .then(response => response.body.getReader())
    .then(parseData)
    .then(mergeUint8Array);
  console.log(circuit, ' program fetched ');
  pkKey = await fetch(pkKey)
    .then(response => response.body.getReader())
    .then(parseData)
    .then(mergeUint8Array);
  console.log(circuit, ' pkKey fetched ');

  return { abi, program, pkKey };
}