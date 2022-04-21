import childProcess from 'child_process';
import fs from 'fs';

const { spawn } = childProcess;

/**
 * Computes a witness from a .code file from `zokrates.compile()` and outputs an witness file.
 *
 * TODO: Needs to check that files and whatnot all exist.
 *
 * @example
 * computeWitness('./code/ft-mint/ft-mint-compiled.code', './code/ft-mint', 'ft-mint-witness', 'gm17');
 *
 * @param {String} codePath - Code file to compile.
 * @param {String} [outputDirectory=./] - Directory to output files into
 * @param {String} [outputName=witness] - Name of file to output
 * @param {Array} arguments to pass to compute witness (flag -a)
 */
export default async function computeWitness(
  codePath,
  outputDirectory = './',
  outputName = 'witness',
  args,
  options = {},
) {
  const { maxReturn = 10000000, verbose = false } = options;

  if (!fs.existsSync(codePath)) {
    throw new Error('compute-witness codePath input file(s) not found');
  }

  if (codePath.endsWith('.code')) {
    // TODO: Not actually sure about this. Nightfall uses the no .code version,
    // the Zokrates documentation says to use the .code version.
    throw new Error('computeWitness expects the compiled code without .code at the end');
  }

  // Ensure path ends with '/'
  const parsedOutputPath = outputDirectory.endsWith('/') ? outputDirectory : `${outputDirectory}/`;

  // TODO: I haven't been able to test if the args actually pass properly,
  // if you run into issues with this function that is probably it.
  return new Promise((resolve, reject) => {
    const zokrates = spawn(
      '/app/zokrates',
      ['compute-witness', '-i', codePath, '-o', `${parsedOutputPath}${outputName}`, '-a', ...args],
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
      reject(new Error(`Compute witness failed: ${err}`));
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
