import axios from 'axios';
import fs from 'fs';
import config from 'config';
import downloadFile from '@polygon-nightfall/common-files/utils/httputils.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import app from './app.mjs';
import rabbitmq from './utils/rabbitmq.mjs';
import queues from './queues/index.mjs';

const {
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
    const circuits = ['deposit', 'transfer', 'withdraw', 'burn', 'tokenise'];

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

          const downloadPath = `${baseUrl}/proving_files/${circuit}/${filename}`;

          try {
            await downloadFile(downloadPath, `${outputPath}/${circuit}/${filename}`);
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
};

const main = async () => {
  try {
    await checkCircuitsOutput();

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
