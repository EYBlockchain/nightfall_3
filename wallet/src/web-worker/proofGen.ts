import { CompilationArtifacts, initialize, ProofPoints } from 'zokrates-js';

const genProof = async (
  artifacts: CompilationArtifacts,
  witnessInput: Array<any>,
  pk: Uint8Array,
  cb: (proof: ProofPoints) => Promise<IDBValidKey>,
): Promise<IDBValidKey> => {
  const zokratesProvider = await initialize();
  const { witness } = zokratesProvider.computeWitness(artifacts, witnessInput);
  const { proof } = zokratesProvider.generateProof(artifacts.program, witness, pk);
  return cb(proof);
};

export default genProof;
