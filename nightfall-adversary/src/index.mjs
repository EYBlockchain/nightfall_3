import logger from 'common-files/utils/logger.mjs';
import { queueManager, queues, enqueueEvent } from 'common-files/utils/event-queue.mjs';
import app from './app.mjs';
import {
  startEventQueue,
  subscribeToBlockAssembledWebSocketConnection,
  subscribeToChallengeWebSocketConnection,
  subscribeToInstantWithDrawalWebSocketConnection,
  eventHandlers,
} from './event-handlers/index.mjs';
import Proposer from './classes/proposer.mjs';
import {
  setBlockAssembledWebSocketConnection,
  conditionalMakeBlock,
} from './services/block-assembler.mjs';
import { setChallengeWebSocketConnection } from './services/challenges.mjs';
import initialBlockSync from './services/state-sync.mjs';
import { setInstantWithdrawalWebSocketConnection } from './services/instant-withdrawal.mjs';

const main = async () => {
  try {
    const proposer = new Proposer();
    // subscribe to WebSocket events first
    await subscribeToBlockAssembledWebSocketConnection(setBlockAssembledWebSocketConnection);
    await subscribeToChallengeWebSocketConnection(setChallengeWebSocketConnection);
    await subscribeToInstantWithDrawalWebSocketConnection(setInstantWithdrawalWebSocketConnection);
    // try to sync any missing blockchain state
    // only then start making blocks and listening to new proposers
    initialBlockSync(proposer).then(async () => {
      await startEventQueue(queueManager, eventHandlers, proposer);
      queues[0].on('end', () => {
        // We do the proposer isMe check here to fail fast instead of re-enqueing.
        logger.info('Queue has emptied. Queueing block assembler.');
        if (proposer.isMe) return enqueueEvent(conditionalMakeBlock, 0, proposer);
        // eslint-disable-next-line no-void, no-useless-return
        return void false; // This is here to satisfy consistent return rules, we do nothing.
      });
      // We enqueue a message so that we can actualy trigger the queue.end call even if we havent received anything.
      // This helps in the case that we restart client and we are the current proposer.
      await enqueueEvent(() => logger.info('Start Queue'), 0);
    });
    app.listen(80);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

main();
