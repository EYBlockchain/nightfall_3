import Queue from 'queue';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

function createQueue(options) {
  const queue = new Queue(options);
  queue.on('error', error => logger.error({ msg: 'Error caught by queue', error }));

  return queue;
}

export const proposerTxsQueue = createQueue({ autostart: true });
export const challengerTxsQueue = createQueue({ autostart: true });
