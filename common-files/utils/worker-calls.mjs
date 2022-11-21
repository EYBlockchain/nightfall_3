/* ignore unused exports */

import axios from 'axios';
import gen from 'general-number';
import config from 'config';

const { generalise } = gen;
const { PROTOCOL, CIRCOM_WORKER_HOST, PROVING_SCHEME, BACKEND } = config;

// eslint-disable-next-line import/prefer-default-export
export async function getCircuitHash(circuitName) {
  const responseCircuitHash = await axios.get(`${PROTOCOL}${CIRCOM_WORKER_HOST}/get-circuit-hash`, {
    params: { circuit: circuitName },
  });

  const circuitHash = generalise(responseCircuitHash.data.slice(0, 12)).hex(5);
  return circuitHash;
}

export async function generateProof({ folderpath, witness }) {
  return axios.post(`${PROTOCOL}${CIRCOM_WORKER_HOST}/generate-proof`, {
    folderpath,
    inputs: witness,
    provingScheme: PROVING_SCHEME,
    backend: BACKEND,
  });
}
