import {
  subscribeToEvents,
  subscribeToBlockProposedEvent,
  subscribeToNewCurrentProposer,
  subscribeToTransactionSubmitted,
  subscribeToBlockAssembledWebSocketConnection,
  subscribeToRollbackEventHandler,
  subscribeToChallengeWebSocketConnection,
  subscribeTocommittedToChallengeEventHandler,
  subscribeToChainReorgEventHandler,
} from './subscribe.mjs';
import blockProposedEventHandler from './block-proposed.mjs';
import newCurrentProposerEventHandler from './new-current-proposer.mjs';
import transactionSubmittedEventHandler from './transaction-submitted.mjs';
import rollbackEventHandler from './rollback.mjs';
import committedToChallengeEventHandler from './challenge-commit.mjs';
import {
  removeRollbackEventHandler,
  removeBlockProposedEventHandler,
  removeCommittedToChallengeEventHandler,
  removeNewCurrentProposerEventHandler,
} from './chain-reorg.mjs';

const eventHandlers = {
  BlockProposed: blockProposedEventHandler,
  TransactionSubmitted: transactionSubmittedEventHandler,
  Rollback: rollbackEventHandler,
  CommittedToChallenge: committedToChallengeEventHandler,
  removers: {
    Rollback: removeRollbackEventHandler,
    BlockProposed: removeBlockProposedEventHandler,
    CommittedToChallenge: removeCommittedToChallengeEventHandler,
    NewCurrentProposer: removeNewCurrentProposerEventHandler,
  },
};

export {
  subscribeToEvents,
  subscribeToBlockProposedEvent,
  subscribeToNewCurrentProposer,
  subscribeToTransactionSubmitted,
  subscribeToBlockAssembledWebSocketConnection,
  subscribeToRollbackEventHandler,
  subscribeToChallengeWebSocketConnection,
  subscribeTocommittedToChallengeEventHandler,
  subscribeToChainReorgEventHandler,
  newCurrentProposerEventHandler,
  eventHandlers,
};
