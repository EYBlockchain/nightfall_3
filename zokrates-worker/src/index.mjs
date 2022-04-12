import axios from 'axios';
import fs from 'fs';
import config from 'config';
import app from './app.mjs';
import rabbitmq from './utils/rabbitmq.mjs';
import queues from './queues/index.mjs';
import logger from './utils/logger.mjs';

const { RADIX_FILES_URL } = config;

const main = async () => {
  try {
    if (!fs.existsSync('./src/radix')) fs.mkdirSync('./src/radix');

    ['deposit', 'double_transfer', 'single_transfer', 'withdraw'].forEach(circuit => {
      if (!fs.existsSync(`./src/radix/${circuit}`)) {
        axios
          .get(`${RADIX_FILES_URL}/${circuit}`, {
            responseType: 'stream',
          })
          .then(response => {
            response.data.pipe(fs.createWriteStream(`./src/radix/${circuit}`));
          })
          .catch(error => {
            throw new Error(error);
          });
      }
    });

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
