import { startEventQueue } from './subscribe.mjs';
import blockProposedEventHandler from './block-proposed.mjs';
import rollbackEventHandler from './rollback.mjs';
import removeBlockProposedEventHandler from './chain-reorg.mjs';
import transactionSubmittedEventHandler from './transaction-submitted.mjs';

const eventHandlers = {
  BlockProposed: blockProposedEventHandler,
  TransactionSubmitted: transactionSubmittedEventHandler,
  Rollback: rollbackEventHandler,
  removers: {
    BlockProposed: removeBlockProposedEventHandler,
  },
  priority: {
    BlockProposed: 0,
    TransactionSubmitted: 1,
    Rollback: 0,
  },
};

export { startEventQueue, eventHandlers };
