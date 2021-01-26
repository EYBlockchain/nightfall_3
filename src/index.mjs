import logger from './utils/logger.mjs';
import app from './app.mjs';
import {
  subscribeToBlockProposedEvent,
  blockProposedEventHandler,
} from './event-handlers/index.mjs';

const main = async () => {
  try {
    await subscribeToBlockProposedEvent(blockProposedEventHandler);
    app.listen(80);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

main();
