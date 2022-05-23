// ignore unused exports default

/*
 * can also be used as worker file to download circuits files from AWS (a worker thread).
 */

import { parseData, mergeUint8Array } from '../../utils/lib/file-reader-utils';

async function fetchCircuitFiles(url) {
  return fetch(url)
    .then(response => response.body.getReader())
    .then(parseData)
    .then(mergeUint8Array);
}

export default async function fetchCircuit(
  circuit,
  { utilApiServerUrl, isLocalRun, circuitsAWSFiles, s3Url },
) {
  let { abi, program, pk } = circuitsAWSFiles[circuit]; // keys path in bucket
  abi = JSON.parse(new TextDecoder().decode(await fetchCircuitFiles(`${s3Url}/${abi}`)));
  program = await fetchCircuitFiles(`${s3Url}/${program}`);
  if (isLocalRun) {
    // here fetchCircuitFiles function is fetching
    // local proving key from zokrates-worker from using
    pk = await fetchCircuitFiles(`${utilApiServerUrl}/${circuit}/${circuit}_pk.key`);
  } else {
    pk = await fetchCircuitFiles(`${s3Url}/${pk}`);
  }
  return { abi, program, pk };
}
