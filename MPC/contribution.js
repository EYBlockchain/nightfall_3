/* eslint-disable no-await-in-loop */
import childProcess from 'child_process';
import fs from 'fs';

import download from 'download';
import axios from 'axios';

const { spawn } = childProcess;

async function contribution(circuitName, random) {
  return new Promise((resolve, reject) => {
    const zokrates = spawn('zokrates', [
      'mpc',
      'contribute',
      '-i',
      `./params/${circuitName}`,
      '-o',
      `./params/out/${circuitName}`,
      '-e',
      random,
    ]);

    zokrates.stderr.on('data', err => {
      reject(new Error(`Setup failed: ${err}`));
    });

    zokrates.on('close', () => {
      resolve();
    });
  });
}

const main = async () => {
  try {
    const RANDOM = (await axios.get('https://api.drand.sh/public/latest')).data.randomness;

    if (!fs.existsSync('./params')) fs.mkdirSync('./params');
    if (!fs.existsSync('./params/out')) fs.mkdirSync('./params/out');

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
      if (!fs.existsSync(`./params/${circuit}`)) {
        await download(`${process.env.MPC_PARAMS_URL}/${circuit}`, `./params`);
      }
      await contribution(circuit, RANDOM);
    }
  } catch (err) {
    // console.log(err);
    process.exit(1);
  }
};

main();
