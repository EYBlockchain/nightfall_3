import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { checkCircuits } from '@polygon-nightfall/common-files/utils/sync-files.mjs';
import app from './app.mjs';
import rabbitmq from './utils/rabbitmq.mjs';
import queues from './queues/index.mjs';

const main = async () => {
  try {
    await checkCircuits();

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
