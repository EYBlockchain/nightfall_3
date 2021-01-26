import config from 'config';
import logger from './utils/logger.mjs';
import app from './app.mjs';
import rabbitmq from './utils/rabbitmq.mjs';
import mongo from './utils/mongo.mjs';
import queues from './queues/index.mjs';

const main = async () => {
  try {
    if (process.env.ENABLE_QUEUE) {
      await rabbitmq.connect();
      queues();
    }
    await mongo.connection(config.MONGO_URL); // get a db connection
    app.listen(80);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

main();
