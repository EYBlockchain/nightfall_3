import childProcess from 'child_process';

const { spawn } = childProcess;

/**
 * Takes in a proving key and a compiled code file and outputs a proof.
 * ./build/prove <circuit.zkey> <witness.wtns> <proof.json> <public.json>
 * @param {String} circuitKey - Path to proving key
 * @param {String} witness - Witness file
 * @param {String} jsonProof - JSON proof as output
 * @param {String} jsonPublic - JSON public inputs as output
 */
export default async function generateProof(circuitKey, witness, jsonProof, jsonPublic) {
  const args = [circuitKey, witness, jsonProof, jsonPublic];

  return new Promise((resolve, reject) => {
    const prover = spawn('/app/prover', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    prover.stderr.on('data', err => {
      reject(new Error(`Generate proof failed: ${err}`));
    });

    prover.on('close', () => {
      // Generate-proof doesn't seem to have any output, so we're not doing the same check as the other functions.
      resolve();
    });
  });
}
