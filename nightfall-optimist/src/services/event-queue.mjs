/**
If we're changing the layer 2 state, we want to make sure that we can complete
that change before the state is further altered by incoming events.  A good
example is when we are deleting the current state. If the new state gets added
while we're deleting, we may delete state that we didn't want deleted.
We achieve that here by queuing events and processing them one after the other
in the strict order that they are received.
Each event type has its own event handler function, which processes the event.
These functions are held in an array `eventHandlers`, which is populated in
`event-handlers/index.mjs` from the functions in the event-handlers directory.
Some events also have a 'remover' function, which is used to handle removal
of the event during a layer1 chain reorganisation (primarilty they delete state
that was removed by the chain reorg and then re-sync state from the new chain
fork).  These remover functions are accessed via the `.removers` property of the
eventHandlers array.
Web3js handles event removal (due to a chain reorg) by re-emitting the (now removed)
event with its `removed` property set to true. In the code below, we look out for
and catch these removals, processing them appropriately.
*/
import Queue from 'queue';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';

const { MAX_QUEUE } = config;
const eventQueue = new Queue({ autostart: true, concurrency: 1 });

async function buffer(eventObject, eventHandlers, ...args) {
  // handlers contains the functions needed to handle particular types of event,
  // including removal of events when a chain reorganisation happens
  if (!eventHandlers[eventObject.event]) {
    logger.debug(`Unknown event ${eventObject.event} ignored`);
    return;
  }
  // if the event was removed then we have a chain reorg and need to reset our
  // layer 2 state accordingly.
  if (eventObject.removed) {
    if (!eventHandlers.removers[eventObject.event]) {
      logger.debug(`Unknown event removal ${eventObject.event} ignored`);
      return;
    }
    logger.info(`Queueing event removal ${eventObject.event}`);
    eventQueue.push(() => eventHandlers.removers[eventObject.event](eventObject, args));
    // otherwise queue the event for processing.
  } else {
    logger.info(`Queueing event ${eventObject.event}`);
    eventQueue.push(() => eventHandlers[eventObject.event](eventObject, args));
  }
  // the queue shouldn't get too long if we're keeping up with the blockchain.
  if (eventQueue.length > MAX_QUEUE)
    logger.warn(`The event queue has more than ${MAX_QUEUE} events`);
}

export default buffer;
