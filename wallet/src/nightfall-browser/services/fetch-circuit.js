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
  let { wasm, zkey, hash } = circuit; // keys path in bucket
  const { wasmh = null, zkeyh = null, hashh = null } = circuit; // keys hash in bucket
  if (isLocalRun) {
    wasm = await fetch(
      `${utilApiServerUrl}/${circuit.name}/${circuit.name}_js/${circuit.name}.wasm`,
    )
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);
    zkey = await fetch(`${utilApiServerUrl}/${circuit.name}/${circuit.name}.zkey`)
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);
    hash = await fetch(`${utilApiServerUrl}/circuithash.txt`)
      .then(response => response.json())
      .then(hashFile =>
        hashFile.find(e => e.circuitName === circuit.name).circuitHash.slice(0, 12),
      );
  } else {
    wasm = await fetchAWSfiles(s3Bucket, wasm);
    zkey = await fetchAWSfiles(s3Bucket, zkey);
    hash = await fetchAWSfiles(s3Bucket, hash);
  }
  return { wasm, wasmh, zkey, zkeyh, hash, hashh };
}
