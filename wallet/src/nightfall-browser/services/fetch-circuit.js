// ignore unused exports

/*
 * can also be used as worker file to download circuits files from AWS (a worker thread).
 */

import S3 from 'aws-sdk/clients/s3';
import { parseData, mergeUint8Array } from '../../utils/lib/file-reader-utils';

const s3 = new S3();

export async function fetchAWSfiles(Bucket, Key) {
  const res = await s3.makeUnauthenticatedRequest('getObject', { Bucket, Key }).promise();
  return res.Body;
}

export async function fetchCircuit(circuit, { utilApiServerUrl, isLocalRun, AWS: { s3Bucket } }) {
  let { abi, program, pk, hash } = circuit; // keys path in bucket
  const { abih = null, programh = null, pkh = null, hashh = null } = circuit; // keys hash in bucket
  if (isLocalRun) {
    abi = await fetch(`${utilApiServerUrl}/${circuit.name}/${circuit.name}_abi.json`).then(
      response => response.json(),
    );
    program = await fetch(`${utilApiServerUrl}/${circuit.name}/${circuit.name}_out`)
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);
    pk = await fetch(`${utilApiServerUrl}/${circuit.name}/${circuit.name}_pk.key`)
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);
    console.log(await fetch(`${utilApiServerUrl}/circuithash.txt`));
    hash = await fetch(`${utilApiServerUrl}/circuithash.txt`).then(response => {
      const hashFile = response.json();
      return `0x${hashFile.find(h => h.circuitName === circuit.name).slice(0, 10)}`;
    });
  } else {
    abi = JSON.parse(new TextDecoder().decode(await fetchAWSfiles(s3Bucket, abi)));
    program = await fetchAWSfiles(s3Bucket, program);
    pk = await fetchAWSfiles(s3Bucket, pk);
    await fetchAWSfiles(s3Bucket);
  }
  return { abi, abih, program, programh, pk, pkh, hash, hashh };
}
