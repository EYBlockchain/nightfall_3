import axios from 'axios';
import fs from 'fs';
import config from 'config';
import downloadFile from 'common-files/utils/httputils.mjs';
import logger from 'common-files/utils/logger.mjs';
import app from './app.mjs';
import rabbitmq from './utils/rabbitmq.mjs';
import queues from './queues/index.mjs';

const {
  MPC: { MPC_PARAMS_URL },
  DEPLOYMENT_FILES_URL: { DEFAULT_CIRCUIT_FILES_URL },
} = config;

const { ETH_NETWORK, CIRCUIT_FILES_URL } = process.env;

const checkCircuitsOutput = async () => {
  let env;
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
    const baseUrl = CIRCUIT_FILES_URL
      ? `${CIRCUIT_FILES_URL}`
      : `${DEFAULT_CIRCUIT_FILES_URL}/${env}`;
    const url = `${baseUrl}/proving_files/hash.txt`;
    const outputPath = `./output`;
    const circuits = ['deposit', 'transfer', 'withdraw'];

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
              `${baseUrl}/proving_files/${circuit}/${f.split('  ')[1]}`,
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
