import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import mongo from 'common-files/utils/mongo.mjs';
import app from './app.mjs';
import rabbitmq from './utils/rabbitmq.mjs';
import queues from './queues/index.mjs';
import { initialClientSync } from './services/state-sync.mjs';
import {
  subscribeToBlockProposedEvent,
  blockProposedEventHandler,
  subscribeToRollbackEventHandler,
  rollbackEventHandler,
} from './event-handlers/index.mjs';

const main = async () => {
  try {
    if (process.env.ENABLE_QUEUE) {
      await rabbitmq.connect();
      queues();
    }
    initialClientSync().then(() => {
      subscribeToBlockProposedEvent(blockProposedEventHandler);
      subscribeToRollbackEventHandler(rollbackEventHandler);
    });
    await mongo.connection(config.MONGO_URL); // get a db connection
    app.listen(80);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

main();
