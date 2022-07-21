import logger from 'common-files/utils/logger.mjs';
import { queueManager, queues, enqueueEvent } from 'common-files/utils/event-queue.mjs';
import RabbitMQ from 'common-files/utils/rabbitmq.mjs';
import app from './app.mjs';
import { startEventQueue, eventHandlers } from './event-handlers/index.mjs';
import Proposer from './classes/proposer.mjs';
import {
  conditionalMakeBlock,
  setBlockAssembledWebSocketConnection,
} from './services/block-assembler.mjs';
import { setChallengeWebSocketConnection } from './services/challenges.mjs';
import initialBlockSync from './services/state-sync.mjs';
import { setProposer } from './routes/proposer.mjs';
import { setInstantWithdrawalWebSocketConnection } from './services/instant-withdrawal.mjs';
import { setBlockProposedWebSocketConnection } from './event-handlers/block-proposed.mjs';

const main = async () => {
  try {
    const proposer = new Proposer();
    setProposer(proposer); // passes the proposer instance int the proposer routes
    // subscribe to WebSocket events first

    const rabbitmq = new RabbitMQ(`${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}`);

    await rabbitmq.connect();
    setChallengeWebSocketConnection(await rabbitmq.subscribe({ queue: 'challenge' }));
    setBlockAssembledWebSocketConnection(await rabbitmq.subscribe({ queue: 'blocks' }));
    setInstantWithdrawalWebSocketConnection(await rabbitmq.subscribe({ queue: 'instant' }));
    setBlockProposedWebSocketConnection(await rabbitmq.subscribe({ queue: 'sync' }));

    // start the event queue
    await startEventQueue(queueManager, eventHandlers, proposer);
    // enqueue the block-assembler every time the queue becomes empty
    queues[0].on('end', () => {
      // We do the proposer isMe check here to fail fast instead of re-enqueing.
      // We check if the queue[2] is empty, this is safe it is manually enqueued/dequeued.
      if (proposer.isMe && queues[2].length === 0) {
        // logger.info('Queue has emptied. Queueing block assembler.');
        return enqueueEvent(conditionalMakeBlock, 0, proposer);
      }
      // eslint-disable-next-line no-void, no-useless-return
      return void false; // This is here to satisfy consistent return rules, we do nothing.
    });
    // We enqueue a message so that we can actualy trigger the queue.end call even if we havent received anything.
    // This helps in the case that we restart client and we are the current proposer.
    await enqueueEvent(() => logger.info('Start Queue'), 0);
    // try to sync any missing blockchain state (event queues will be paused until this finishes)
    initialBlockSync(proposer);
    app.listen(80);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

main();
