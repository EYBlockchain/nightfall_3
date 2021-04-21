import logger from './utils/logger.mjs';
import app from './app.mjs';
import {
  subscribeToBlockProposedEvent,
  blockProposedEventHandler,
  subscribeToNewCurrentProposer,
  newCurrentProposerEventHandler,
  subscribeToTransactionSubmitted,
  transactionSubmittedEventHandler,
  subscribeToBlockAssembledWebSocketConnection,
  subscribeToBlockDeletedEventHandler,
  subscribeToChallengeWebSocketConnection,
  blockDeletedEventHandler,
  subscribeTocommittedToChallengeEventHandler,
  committedToChallengeEventHandler,
} from './event-handlers/index.mjs';
import Proposer from './classes/proposer.mjs';
import {
  conditionalMakeBlock,
  setBlockAssembledWebSocketConnection,
} from './services/block-assembler.mjs';
import { setChallengeWebSocketConnection } from './services/challenges.mjs';

const main = async () => {
  try {
    const proposer = new Proposer();
    // subscribe to blockchain events
    subscribeToBlockProposedEvent(blockProposedEventHandler);
    subscribeToNewCurrentProposer(newCurrentProposerEventHandler, proposer);
    subscribeToTransactionSubmitted(transactionSubmittedEventHandler);
    subscribeToBlockDeletedEventHandler(blockDeletedEventHandler);
    subscribeTocommittedToChallengeEventHandler(committedToChallengeEventHandler);
    // subscribe to WebSocket events
    subscribeToBlockAssembledWebSocketConnection(setBlockAssembledWebSocketConnection);
    subscribeToChallengeWebSocketConnection(setChallengeWebSocketConnection);
    // start making blocks whenever we can
    conditionalMakeBlock(proposer);
    app.listen(80);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

main();
