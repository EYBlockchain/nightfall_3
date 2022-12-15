import {
  startEventQueue,
  subscribeToChallengeWebSocketConnection,
  subscribeToInstantWithDrawalWebSocketConnection,
} from './subscribe.mjs';
import blockProposedEventHandler from './block-proposed.mjs';
import newCurrentProposerEventHandler from './new-current-proposer.mjs';
import transactionSubmittedEventHandler from './transaction-submitted.mjs';
import rollbackEventHandler from './rollback.mjs';
import committedToChallengeEventHandler from './challenge-commit.mjs';
import instantWithdrawalRequestedEventHandler from './instant-withdrawal.mjs';
import {
  removeBlockProposedEventHandler,
  removeCommittedToChallengeEventHandler,
  removeNewCurrentProposerEventHandler,
  removeTransactionSubmittedEventHandler,
} from './chain-reorg.mjs';

const eventHandlers = {
  BlockProposed: blockProposedEventHandler,
  TransactionSubmitted: transactionSubmittedEventHandler,
  Rollback: rollbackEventHandler,
  CommittedToChallenge: committedToChallengeEventHandler,
  NewCurrentProposer: newCurrentProposerEventHandler,
  InstantWithdrawalRequested: instantWithdrawalRequestedEventHandler,
  removers: {
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
    InstantWithdrawalRequested: 1,
  },
};

export {
  startEventQueue,
  subscribeToChallengeWebSocketConnection,
  subscribeToInstantWithDrawalWebSocketConnection,
  eventHandlers,
};
