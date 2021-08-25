import logger from 'common-files/utils/logger.mjs';
import app from './app.mjs';
import {
  subscribeToEvents,
  subscribeToNewCurrentProposer,
  subscribeToBlockAssembledWebSocketConnection,
  subscribeToChallengeWebSocketConnection,
  newCurrentProposerEventHandler,
  eventHandlers,
} from './event-handlers/index.mjs';
import Proposer from './classes/proposer.mjs';
import {
  conditionalMakeBlock,
  setBlockAssembledWebSocketConnection,
} from './services/block-assembler.mjs';
import { setChallengeWebSocketConnection } from './services/challenges.mjs';
import initialBlockSync from './services/state-sync.mjs';
import buffer from './services/event-buffer.mjs';

const main = async () => {
  try {
    const proposer = new Proposer();
    // subscribe to WebSocket events first
    await subscribeToBlockAssembledWebSocketConnection(setBlockAssembledWebSocketConnection);
    await subscribeToChallengeWebSocketConnection(setChallengeWebSocketConnection);
    // try to sync any missing blockchain state
    // only then start making blocks and listening to new proposers
    initialBlockSync(proposer).then(() => {
      subscribeToNewCurrentProposer(newCurrentProposerEventHandler, proposer);
      conditionalMakeBlock(proposer);
    });
    // we do not wait for the initial block sync for these event handlers
    // as we want to still listen to incoming events (just not make blocks)
    // subscribe to blockchain events
    subscribeToEvents(buffer, eventHandlers);
    app.listen(80);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

main();
