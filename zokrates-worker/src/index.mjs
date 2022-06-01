import axios from 'axios';
import fs from 'fs';
import * as stream from 'stream';
import { promisify } from 'util';
import config from 'config';
import app from './app.mjs';
import rabbitmq from './utils/rabbitmq.mjs';
import queues from './queues/index.mjs';
import logger from './utils/logger.mjs';

const {
  MPC: { MPC_PARAMS_URL },
} = config;

const { ETH_NETWORK, CIRCUIT_FILES_URL } = process.env;

const finished = promisify(stream.finished);

const downloadFile = async (fileUrl, outputLocationPath) => {
  const writer = fs.createWriteStream(outputLocationPath);
  return axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  }).then(response => {
    response.data.pipe(writer);
    return finished(writer); // this is a Promise
  });
};

const checkCircuitsOutput = async () => {
  let env = '';
  switch (ETH_NETWORK) {
    case 'goerli':
      env = 'testnet';
      break;
    case 'mainnet':
      env = 'production';
      break;
    default:
      env = '';
  }

  if (env) {
    const url = `${CIRCUIT_FILES_URL}/${env}/proving_files/hash.txt`;
    const outputPath = `./output`;
    const circuits = ['deposit', 'double_transfer', 'single_transfer', 'withdraw'];

    const res = await axios.get(url); // get all circuit files
    const files = res.data.split('\n');

    logger.info(`Downloading output files from ${url}...`);

    await Promise.all(
      files.map(async f => {
        if (f) {
          const filename = f.split('  ')[1];
          const circuit = circuits.find(c => filename.includes(c));

          if (!fs.existsSync(`${outputPath}/${circuit}`)) {
            fs.mkdirSync(`${outputPath}/${circuit}`);
          }

          try {
            await downloadFile(
              `${CIRCUIT_FILES_URL}/${env}/proving_files/${circuit}/${f.split('  ')[1]}`,
              `${outputPath}/${circuit}/${f.split('  ')[1]}`,
            );
          } catch (e) {
            console.error(`ERROR downloading ${f.split('  ')[1]}`);
          }
        }
      }),
    );
    logger.info(`Output files downloaded`);
  }
};

const main = async () => {
  try {
    await checkCircuitsOutput();

    if (!fs.existsSync('./mpc_params')) fs.mkdirSync('./mpc_params');

    const mpcPromises = [];

    for (const circuit of ['deposit', 'double_transfer', 'single_transfer', 'withdraw']) {
      if (!fs.existsSync(`./mpc_params/${circuit}`)) {
        mpcPromises.push(
          new Promise((resolve, reject) => {
            axios
              .get(`${MPC_PARAMS_URL}/${circuit}`, {
                responseType: 'stream',
              })
              .then(response => {
                resolve();
                response.data.pipe(fs.createWriteStream(`./mpc_params/${circuit}`));
              })
              .catch(error => {
                reject();
                logger.error(error);
                throw new Error(error);
              });
          }),
        );
      }
    }

    await Promise.all(mpcPromises);

    // 1 means enable it
    // 0 mean keep it disabled
    if (Number(process.env.ENABLE_QUEUE)) {
      await rabbitmq.connect();
      queues();
    }

    app.listen(80);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

main();
