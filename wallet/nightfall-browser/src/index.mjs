import logger from 'common-files/utils/logger.mjs';
import { queueManager } from 'common-files/utils/event-queue.mjs';
import { initialClientSync } from './services/state-sync.mjs';
import { startEventQueue, eventHandlers } from './event-handlers/index.mjs';

const main = async () => {
  try {
    initialClientSync().then(async () => {
      await startEventQueue(queueManager, eventHandlers);
    });
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

main();
