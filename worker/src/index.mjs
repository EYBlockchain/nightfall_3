import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { checkCircuits } from '@polygon-nightfall/common-files/utils/sync-files.mjs';
import config from 'config';
import app from './app.mjs';
import rabbitmq from './utils/rabbitmq.mjs';
import queues from './queues/index.mjs';

const {
  DEPLOYMENT_FILES_URL: { CONTRACT_FILES_URL = '' },
  DEPLOYMENT_FILES_URL: { CIRCUIT_FILES_URL = '' },
} = config;

const main = async () => {
  try {
    console.log('Start....', process.env.ENABLE_QUEUE);
    console.log('CIRCUIT_FILES', CIRCUIT_FILES_URL, CONTRACT_FILES_URL);
    await checkCircuits();
    console.log('check circuits done....');

    // 1 means enable it
    // 0 mean keep it disabled
    if (Number(process.env.ENABLE_QUEUE)) {
      console.log('connect rabbitmq...');
      await rabbitmq.connect();
      console.log('rabbitmq connected...');
      queues();
    }
    console.log('done');

    app.listen(80);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

main();
