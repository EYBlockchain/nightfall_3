// ignore unused exports default

import { initialize } from 'zokrates-js';

let zokratesProvider;

export default async function generateProof(artifacts, witnessInput, provingKey) {
  if (!zokratesProvider) zokratesProvider = await initialize();
  const { witness } = zokratesProvider.computeWitness(artifacts, witnessInput);
  return zokratesProvider.generateProof(artifacts.program, witness, provingKey);
}
