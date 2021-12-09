// ignore unused exports startEventQueue, eventHandlers

import { startEventQueue } from './subscribe';
import blockProposedEventHandler from './block-proposed';
import rollbackEventHandler from './rollback';
import removeBlockProposedEventHandler from './chain-reorg';

const eventHandlers = {
  BlockProposed: blockProposedEventHandler,
  Rollback: rollbackEventHandler,
  removers: {
    BlockProposed: removeBlockProposedEventHandler,
  },
  priority: {
    BlockProposed: 0,
    Rollback: 0,
  },
};

export { startEventQueue, eventHandlers };
