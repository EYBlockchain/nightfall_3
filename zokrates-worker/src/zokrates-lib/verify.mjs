import childProcess from 'child_process';
import jsonfile from 'jsonfile';

import { deleteSingleFile } from '../utils/filing.mjs';

const { spawn } = childProcess;
const { writeFile } = jsonfile;

/**
 * Takes in a proof and a verification key and determines if the proof verifies.
 * @param {String} vk - Verification Key
 * @param {String} proof
 * @param {String} backEnd - Available options are 'libsnark', 'bellman', 'ark'
 * @returns {Object} JSON of the proof.
 */
export default async function verify(vk, proof, backend = 'bellman') {
  // we've provided a json proof and a verifying key but Zokrates needs to read
  // these from a file. Thus we should write them to temporary unique files.
  // Note: Math.random is used to create unique filename to avoid error at concurrent execution.
  const proofTempFile = `/tmp/proof-${Math.random()}-${Math.random()}.json`;
  const vkTempFile = `/tmp/verify-${Math.random()}-${Math.random()}.key`;
  await Promise.all([writeFile(vkTempFile, vk), writeFile(proofTempFile, proof)]);

  const args = ['verify', '-v', vkTempFile, '-j', proofTempFile, '--backend', backend];

  return new Promise((resolve, reject) => {
    const zokrates = spawn('/app/zokrates', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ZOKRATES_STDLIB: process.env.ZOKRATES_STDLIB,
      },
    });

    let output = '';
    zokrates.stdout.on('data', data => {
      output += data.toString('utf8');
    });

    zokrates.stderr.on('data', err => {
      reject(new Error(`Verify failed: ${err}`));
    });

    zokrates.on('close', () => {
      // we no longer need the temporary files
      deleteSingleFile(proofTempFile);
      deleteSingleFile(vkTempFile);
      // ZoKrates sometimes outputs error through stdout instead of stderr,
      // so we need to catch those errors manually.
      if (output.includes('panicked')) reject(new Error(output.slice(output.indexOf('panicked'))));

      if (output.includes('PASS')) resolve(true);
      else resolve(false);
    });
  });
}
