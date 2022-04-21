import childProcess from 'child_process';
import fs from 'fs';

const { spawn } = childProcess;

/**
 * Compiles code found at `codePath` and outputs verifying and proving keys.
 *
 * TODO: Needs to check that files and whatnot all exist.
 *
 * @example
 * // Will generate keys at ft-mint-vk.key and ft-mint-pk.key
 * setup('./code/ft-mint/ft-mint', './', 'gm17', 'ft-mint-vk', 'ft-mint-pk');
 *
 * @param {String} codePath - Path of code file to compile
 * @param {String} outputPath - Directory to output, defaults to current directory
 * @param {String} provingScheme - Available options are g16, pghr13, gm17
 * @param {String} backEnd - Available options are 'libsnark', 'bellman', 'ark'
 * @param {String} vkName - name of verification key file, defaults to verification.key
 * @param {String} pkName - name of proving key file, defaults to proving.key
 */
export default async function setup(
  codePath,
  outputPath = './',
  provingScheme = 'g16',
  backend = 'bellman',
  vkName = 'verification.key',
  pkName = 'proving.key',
  options = {},
) {
  const { maxReturn = 10000000, verbose = false } = options;

  if (!fs.existsSync(codePath)) {
    throw new Error('Setup input file(s) not found');
  }

  if (codePath.endsWith('.zok')) {
    throw new Error(
      'Setup cannot take the .zok version, use the compiled version with no extension.',
    );
  }

  // Ensure path ends with '/'
  const parsedOutputPath = outputPath.endsWith('/') ? outputPath : `${outputPath}/`;

  // Ensure the keys end with `.key`
  const vkWithKey = vkName.endsWith('.key') ? vkName : `${vkName}.key`;
  const pkWithKey = pkName.endsWith('.key') ? pkName : `${pkName}.key`;

  const vkPath = `${parsedOutputPath}${vkWithKey}`;
  const pkPath = `${parsedOutputPath}${pkWithKey}`;
  return new Promise((resolve, reject) => {
    const zokrates = spawn(
      '/app/zokrates',
      [
        'setup',
        '-i',
        codePath,
        '--proving-scheme',
        provingScheme,
        '--backend',
        backend,
        '-v',
        vkPath,
        '-p',
        pkPath,
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ZOKRATES_STDLIB: process.env.ZOKRATES_STDLIB,
        },
      },
    );

    let output = '';

    zokrates.stdout.on('data', data => {
      if (verbose) {
        output += data.toString('utf8');
        // If the entire output gets too large, just send ...[truncated].
        if (output.length > maxReturn) output = '...[truncated]';
      }
    });

    zokrates.stderr.on('data', err => {
      reject(new Error(`Setup failed: ${err}`));
    });

    zokrates.on('close', () => {
      // ZoKrates sometimes outputs error through stdout instead of stderr,
      // so we need to catch those errors manually.
      if (output.includes('panicked')) {
        reject(new Error(output.slice(output.indexOf('panicked'))));
      }
      if (verbose) resolve(output);
      else resolve();
    });
  });
}
