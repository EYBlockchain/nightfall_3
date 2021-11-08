import { startEventQueue } from './subscribe.mjs';
import blockProposedEventHandler from './block-proposed.mjs';
import rollbackEventHandler from './rollback.mjs';

const eventHandlers = {
  BlockProposed: blockProposedEventHandler,
  Rollback: rollbackEventHandler,
  // removers: {
  // BlockProposed: removeBlockProposedEventHandler,
  // },
  priority: {
    BlockProposed: 0,
    Rollback: 0,
  },
};

export { startEventQueue, eventHandlers };
