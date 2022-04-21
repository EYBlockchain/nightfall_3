import childProcess from 'child_process';
import fs from 'fs';

const { spawn } = childProcess;

/**
 * Takes in a proving key and a compiled code file and outputs a proof.
 *
 * TODO: Needs to check that files and whatnot all exist.
 * TODO: Haven't been able to test it yet, I need values from the Nightfall repository.
 *
 * @example
 * generateProof('./code/ft-mint/ft-mint-pk.key',
 *   './code/ft-mint/ft-mint-compiled',
 *   'gm17',
 *   {
 *     createFile: true,
 *     directory: './code/ft-mint',
 *     fileName: 'ft-mint-proof.json',
 *   },
 * );
 *
 * @param {String} provingKeyPath - Path to proving key
 * @param {String} codePath - Path to code file (Result of compile that doesn't end in .code)
 * @param {String} provingScheme - Available options are 'g16', 'pghr13', 'gm17'
 * @param {String} backEnd - Available options are 'libsnark', 'bellman', 'ark'
 * @param {Object} [options] - Options for output
 * @param {Boolean} options.createFile - Whether or not to output a json file
 * @param {String} [options.directory=./] - Directory to output files in
 * @param {String} [options.fileName=proof.json] - Name of JSON proof file ()
 * @returns {Object} JSON of the proof.
 */
export default async function generateProof(
  provingKeyPath,
  codePath,
  witnessPath,
  provingScheme = 'g16',
  backend = 'bellman',
  options = {},
) {
  if (!fs.existsSync(codePath)) {
    throw new Error('generate-proof codePath input file(s) not found');
  }

  if (!fs.existsSync(provingKeyPath)) {
    throw new Error('generate-proof proving key path file not found');
  }

  if (codePath.endsWith('.zok')) {
    throw new Error("Expected the compiled code that didn't end in .code");
  }

  if (!provingKeyPath.endsWith('.key')) {
    throw new Error('Expected a .key file');
  }

  // Whether we need to create a file or not.
  const createFile = options && options.createFile;

  const args = [
    'generate-proof',
    '-i',
    codePath,
    '--proving-scheme',
    provingScheme,
    '--backend',
    backend,
    '-w',
    witnessPath,
    '-p',
    provingKeyPath,
  ];

  if (createFile) {
    // Ensure path ends with '/'
    const { directory } = options;
    const parsedOutputPath = directory.endsWith('/') ? directory : `${directory}/`;

    const fileName = options.fileName ? options.fileName : 'proof.json';
    const parsedFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;

    args.push('-j');
    args.push(`${parsedOutputPath}${parsedFileName}`);
  }
  return new Promise((resolve, reject) => {
    const zokrates = spawn('/app/zokrates', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      env: {
        ZOKRATES_STDLIB: process.env.ZOKRATES_STDLIB,
      },
    });

    zokrates.stderr.on('data', err => {
      reject(new Error(`Generate proof failed: ${err}`));
    });

    zokrates.on('close', () => {
      // Generate-proof doesn't seem to have any output, so we're not doing the same check as the other functions.
      resolve();
    });
  });
}
