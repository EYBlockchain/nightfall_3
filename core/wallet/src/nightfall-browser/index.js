import logger from '../common-files/utils/logger';
import { queueManager } from '../common-files/utils/event-queue';
import { initialClientSync } from './services/state-sync';
import { startEventQueue, eventHandlers } from './event-handlers/index';

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
