import axios from 'axios';
import fs from 'fs';
import config from 'config';
import app from './app.mjs';
import rabbitmq from './utils/rabbitmq.mjs';
import queues from './queues/index.mjs';
import logger from './utils/logger.mjs';

const {
  MPC: { MPC_PARAMS_URL },
} = config;

const main = async () => {
  try {
    if (!fs.existsSync('./mpc_params')) fs.mkdirSync('./mpc_params');

    const mpcPromises = [];

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
