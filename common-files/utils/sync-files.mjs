/* ignore unused exports */
import axios from 'axios';
import fs from 'fs';
import config from 'config';
import logger from './logger.mjs';
import downloadFile from './httputils.mjs';

const {
  CONTRACT_ARTIFACTS,
  DEPLOYMENT_FILES_URL: { CONTRACT_FILES_URL = '' },
  DEPLOYMENT_FILES_URL: { CIRCUIT_FILES_URL = '' },
} = config;

export async function checkContractsABI() {
  if (CONTRACT_FILES_URL !== '') {
    const baseUrl = CONTRACT_FILES_URL;
    const url = `${baseUrl}/hash.txt`;

    const res = await axios.get(url); // get all json abi contracts
    const files = res.data.split('\n');

    if (!fs.existsSync(`${CONTRACT_ARTIFACTS}`)) {
      fs.mkdirSync(`${CONTRACT_ARTIFACTS}`);
    }

    let localFiles = [];
    try {
      localFiles = fs.readFileSync(`${CONTRACT_ARTIFACTS}/hash.txt`).split('\n');
    } catch (e) {
      console.error('hash.txt not found');
    }

    logger.info(`Downloading contracts from ${url}...`);

    await Promise.all(
      files.map(async f => {
        if (f) {
          const hashRemote = f.split('  ')[0];
          const filename = f.split('  ')[1];
          let hashLocal = '0';
          if (localFiles.length) {
            // eslint-disable-next-line prefer-destructuring
            hashLocal = localFiles.find(c => c.includes(filename)).split('  ')[0];
          }
          if (hashRemote === hashLocal) return;
          try {
            await downloadFile(
              `${baseUrl}/contracts/${f.split('  ')[1]}`,
              `${CONTRACT_ARTIFACTS}/${f.split('  ')[1]}`,
            );
          } catch (e) {
            console.error(`ERROR downloading ${f.split('  ')[1]}`);
          }
        }
      }),
    );

    console.log('DOWNLOADING HASH');
    try {
      await downloadFile(`${baseUrl}/hash.txt`, `${CONTRACT_ARTIFACTS}/hash.txt`);
    } catch (e) {
      console.error(`ERROR downloading hash.txt`);
    }
    logger.info(`Contracts downloaded`);
  }
}

async function getCircuitNames() {
  const circuits = [];
  const baseUrl = CIRCUIT_FILES_URL;
  const url = `${baseUrl}/circuithash.txt`;
  const res = await axios.get(url); // get all circuit files
  const circuitHash = res.data;
  for (const elem of circuitHash) {
    if ('circuitName' in elem) {
      circuits.push(elem.circuitName);
    }
  }
  return circuits;
}

export async function checkCircuits() {
  if (CIRCUIT_FILES_URL !== '') {
    const baseUrl = CIRCUIT_FILES_URL;
    const url = `${baseUrl}/hash.txt`;
    const outputPath = `./output`;
    const circuits = await getCircuitNames();
    let localFiles = [];
    try {
      localFiles = fs.readFileSync(`${outputPath}/hash.txt`).split('\n');
    } catch (e) {
      console.error('hash.txt not found');
    }

    const res = await axios.get(url); // get all circuit files
    const files = res.data.split('\n');

    logger.info(`Downloading output files from ${url}...`);

    await Promise.all(
      files.map(async f => {
        if (f) {
          const filename = f.split('  ')[1];
          const extension = f.split('.')[1];
          const hashRemote = f.split('  ')[0];
          let hashLocal = '0';
          if (localFiles.length) {
            // eslint-disable-next-line prefer-destructuring
            hashLocal = localFiles.find(c => c.includes(filename)).split('  ')[0];
          }

          let circuit = circuits.find(c => filename.includes(c))
            ? `${circuits.find(c => filename.includes(c))}/`
            : '';

          if (!fs.existsSync(`${outputPath}/${circuit}`)) {
            fs.mkdirSync(`${outputPath}/${circuit}`);
          }
          // select wasm, zkey and txt files with different local and remote hash
          if (extension === 'wasm' && hashLocal !== hashRemote) {
            circuit = `${circuit}${circuit.slice(0, -1)}_js/`;
          } else if ((extension === 'zkey' && hashLocal === hashRemote) || extension !== 'txt') {
            return;
          }

          if (!fs.existsSync(`${outputPath}/${circuit}`)) {
            fs.mkdirSync(`${outputPath}/${circuit}`);
          }

          const downloadPath = `${baseUrl}/${circuit}${filename}`;

          try {
            await downloadFile(downloadPath, `${outputPath}/${circuit}${filename}`);
          } catch (e) {
            logger.error({
              message: `ERROR downloading ${filename}`,
              error: e,
            });
          }
        }
      }),
    );
    logger.info(`Output files downloaded`);
  }
}
