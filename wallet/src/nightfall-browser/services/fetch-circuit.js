// ignore unused exports default

/*
 * can also be used as worker file to download circuits files from AWS (a worker thread).
 */

import axios from 'axios';

import { parseData, mergeUint8Array } from '../../utils/lib/file-reader-utils';

export default async function fetchCircuit(circuit, { utilApiServerUrl, isLocalRun }) {
  let { abi, program, pk } = (await axios.get(`${utilApiServerUrl}/browser-circuit/${circuit}`))
    .data;
  abi = (await axios.get(abi)).data;
  program = await fetch(program)
    .then(response => response.body.getReader())
    .then(parseData)
    .then(mergeUint8Array);
  console.log(circuit, ' program fetched');

  if (isLocalRun) {
    pk = `${utilApiServerUrl}/${circuit}/${circuit}_pk.key`;
  }

  pk = await fetch(pk)
    .then(response => response.body.getReader())
    .then(parseData)
    .then(mergeUint8Array);
  console.log(circuit, ' pk fetched');

  return { abi, program, pk };
}
