/* eslint-disable no-await-in-loop */
import childProcess from 'child_process';
import fs from 'fs';

import 'dotenv/config';
import download from 'download';

const { spawn } = childProcess;

async function ceremony(circuitName) {
  return new Promise((resolve, reject) => {
    const zokrates = spawn('zokrates', [
      'mpc',
      'init',
      '-i',
      `./compiled_circuits/${circuitName}-program`,
      '-o',
      `./params/${circuitName}`,
      '-r',
      `./radix/${circuitName}`,
    ]);

    let output = '';

    zokrates.stdout.on('data', data => {
      output += data.toString('utf8');
    });

    zokrates.stderr.on('data', err => {
      console.log(err);
      reject(new Error(`Setup failed: ${err}`));
    });

    zokrates.on('close', () => {
      console.log(output);
      // ZoKrates sometimes outputs error through stdout instead of stderr,
      // so we need to catch those errors manually.
      if (output.includes('panicked')) {
        reject(new Error(output.slice(output.indexOf('panicked'))));
      }
      resolve(output);
    });
  });
}
const main = async () => {
  try {
    if (!fs.existsSync('./radix')) fs.mkdirSync('./radix');
    if (!fs.existsSync('./params')) fs.mkdirSync('./params');

    for (const circuit of [
      'deposit',
      'double_transfer',
      'single_transfer',
      'withdraw',
      'deposit_stub',
      'withdraw_stub',
      'double_transfer_stub',
      'single_transfer_stub',
    ]) {
      if (!fs.existsSync(`./compiled_circuits/${circuit}`)) {
        await download(
          `${process.env.CIRCUIT_FILES_URL}/${circuit}/artifacts/${circuit}-program`,
          `./compiled_circuits`,
        );
      }

      if (!fs.existsSync(`./radix/${circuit}`)) {
        await download(`${process.env.RADIX_FILES_URL}/${circuit}`, `./radix`);
      }

      await ceremony(circuit);
    }
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

main();
