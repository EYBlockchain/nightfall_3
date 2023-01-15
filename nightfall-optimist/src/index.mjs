import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import {
  queueManager,
  queues,
  enqueueEvent,
} from '@polygon-nightfall/common-files/utils/event-queue.mjs';
import { checkContractsABI } from '@polygon-nightfall/common-files/utils/sync-files.mjs';
import app from './app.mjs';
import {
  startEventQueue,
  subscribeToChallengeWebSocketConnection,
  subscribeToInstantWithDrawalWebSocketConnection,
  eventHandlers,
} from './event-handlers/index.mjs';
import Proposer from './classes/proposer.mjs';
import { conditionalMakeBlock } from './services/block-assembler.mjs';
import { setChallengeWebSocketConnection } from './services/challenges.mjs';
import initialBlockSync from './services/state-sync.mjs';
import { setInstantWithdrawalWebSocketConnection } from './services/instant-withdrawal.mjs';
import { setProposer } from './routes/proposer.mjs';
import autoChangeCurrentProposer from './services/auto-change-current-proposer.mjs';

const main = async () => {
  try {
    await checkContractsABI();
    const proposer = new Proposer();
    setProposer(proposer); // passes the proposer instance int the proposer routes
    const proposerEthAddress = app.get('proposerEthAddress');
    autoChangeCurrentProposer(proposerEthAddress); // starts the auto change current proposer service
    // subscribe to WebSocket events first
    await subscribeToChallengeWebSocketConnection(setChallengeWebSocketConnection);
    await subscribeToInstantWithDrawalWebSocketConnection(setInstantWithdrawalWebSocketConnection);
    await startEventQueue(queueManager, eventHandlers, proposer);

    // enqueue the block-assembler every time the queue becomes empty
    queues[0].on('end', () => {
      // We do the proposer isMe check here to fail fast instead of re-enqueuing.
      // We check if the queue[2] is empty, this is safe it is manually enqueued/dequeued.
      if (proposer.isMe && queues[2].length === 0) {
        // logger.debug('Queue has emptied. Queueing block assembler.');
        const proposerEthPrivateKey = app.get('proposerEthPrivateKey');
        const args = { proposer, proposerEthAddress, proposerEthPrivateKey };
        return enqueueEvent(conditionalMakeBlock, 0, args);
      }
      // eslint-disable-next-line no-void, no-useless-return
      return void false; // This is here to satisfy consistent return rules, we do nothing.
    });

    /*
     We enqueue a message so that we can actually trigger the queue.end call even if we haven't received anything.
     This helps in the case that we restart client and we are the current proposer.
    */
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
