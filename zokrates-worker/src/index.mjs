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

    const radixPromises = [];

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
      if (!fs.existsSync(`./src/radix/${circuit}`)) {
        radixPromises.push(
          new Promise((resolve, reject) => {
            axios
              .get(`${RADIX_FILES_URL}/${circuit}`, {
                responseType: 'stream',
              })
              .then(response => {
                resolve();
                response.data.pipe(fs.createWriteStream(`./src/radix/${circuit}`));
              })
              .catch(error => {
                reject();
                throw new Error(error);
              });
          }),
        );
      }
    }

    await Promise.all(radixPromises);

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
