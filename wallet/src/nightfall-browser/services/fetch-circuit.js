// ignore unused exports default

/*
 * can also be used as worker file to download circuits files from AWS (a worker thread).
 */

import S3 from 'aws-sdk/clients/s3';
import { parseData, mergeUint8Array } from '../../utils/lib/file-reader-utils';

const s3 = new S3();

async function fetchAWSfiles(Bucket, Key) {
  const res = await s3.makeUnauthenticatedRequest('getObject', { Bucket, Key }).promise();
  return res.Body;
}

export default async function fetchCircuit(
  circuit,
  { utilApiServerUrl, isLocalRun, AWS: { s3Bucket, circuitFiles } },
) {
  let { abi, program, pk } = circuitFiles[circuit]; // keys path in bucket
  if (isLocalRun) {
    abi = await fetch(`${utilApiServerUrl}/${circuit}/abi.json`).then(response => response.json());
    program = await fetch(`${utilApiServerUrl}/${circuit}/${circuit}_out`)
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);
    pk = await fetch(`${utilApiServerUrl}/${circuit}/${circuit}_pk.key`)
      .then(response => response.body.getReader())
      .then(parseData)
      .then(mergeUint8Array);
  } else {
    abi = JSON.parse(new TextDecoder().decode(await fetchAWSfiles(s3Bucket, abi)));
    program = await fetchAWSfiles(s3Bucket, program);
    pk = await fetchAWSfiles(s3Bucket, pk);
  }
  return { abi, program, pk };
}
