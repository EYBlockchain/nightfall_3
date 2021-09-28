import {
  startEventQueue,
  subscribeToBlockAssembledWebSocketConnection,
  subscribeToChallengeWebSocketConnection,
} from './subscribe.mjs';
import blockProposedEventHandler from './block-proposed.mjs';
import newCurrentProposerEventHandler from './new-current-proposer.mjs';
import transactionSubmittedEventHandler from './transaction-submitted.mjs';
import rollbackEventHandler from './rollback.mjs';
import committedToChallengeEventHandler from './challenge-commit.mjs';
import {
  removeBlockProposedEventHandler,
  removeCommittedToChallengeEventHandler,
  removeNewCurrentProposerEventHandler,
  removeTransactionSubmittedEventHandler,
  removeRollbackEventHandler,
} from './chain-reorg.mjs';

const eventHandlers = {
  BlockProposed: blockProposedEventHandler,
  TransactionSubmitted: transactionSubmittedEventHandler,
  Rollback: rollbackEventHandler,
  CommittedToChallenge: committedToChallengeEventHandler,
  NewCurrentProposer: newCurrentProposerEventHandler,
  removers: {
    Rollback: removeRollbackEventHandler,
    BlockProposed: removeBlockProposedEventHandler,
    CommittedToChallenge: removeCommittedToChallengeEventHandler,
    TransactionSubmitted: removeTransactionSubmittedEventHandler,
    NewCurrentProposer: removeNewCurrentProposerEventHandler,
  },
  priority: {
    BlockProposed: 0,
    TransactionSubmitted: 1,
    Rollback: 0,
    CommittedToChallenge: 0,
    NewCurrentProposer: 0,
  },
};

export {
  startEventQueue,
  subscribeToBlockAssembledWebSocketConnection,
  subscribeToChallengeWebSocketConnection,
  eventHandlers,
};
