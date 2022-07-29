/* ignore unused exports */

import { wrap } from 'comlink';

import generateProofWorker from '../../web-worker/generateProof.shared-worker';

const generateProof = wrap(generateProofWorker().port);

export default async function (...args) {
  const id = `${new Date().valueOf()}-${Math.random()}`;
  global.sharedWorkerpool.add(id);
  const { proof } = await generateProof(...args);
  global.sharedWorkerpool.delete(id);
  return proof;
}
