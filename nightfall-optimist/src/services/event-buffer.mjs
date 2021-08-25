/**
If we're changing the layer 2 state, we want to make sure that we can complete
that change before the state is further altered by incoming events.  A good
example is when we are deleting the current state. If the new state gets added
while we're deleting, we may delete state that we didn't want deleted.
We achieve that here by queuing events and processing them one after the other
in the strict order that they are received.
*/
import Queue from 'queue';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';

const { MAX_QUEUE } = config;
const eventQueue = new Queue({ autostart: true, concurrency: 1 });

async function buffer(eventObject, eventHandlers) {
  // handlers contains the functions needed to handle particular types of event,
  // including removal of events when a chain reorganisation happens
  if (!eventHandlers[eventObject.event]) {
    logger.debug(`Unknown event ${eventObject.event} ignored`);
    return;
  }
  logger.info(`Queued event ${eventObject.event}`);
  // if the event was removed then we have a chain reorg and need to reset our
  // layer 2 state accordingly.
  if (eventObject.removed) {
    if (!eventHandlers.removers[eventObject.event]) {
      logger.debug(`Unknown event removal ${eventObject.event} ignored`);
      return;
    }
    eventQueue.push(() =>
      eventHandlers.removers[eventObject.event](eventObject, eventHandlers, eventQueue),
    );
    // otherwise queue the event for processing.
  } else eventQueue.push(() => eventHandlers[eventObject.event](eventObject));
  // the queue shouldn't get too long if we're keeping up with the blockchain.
  if (eventQueue.length > MAX_QUEUE)
    logger.warn(`The event queue has more than ${MAX_QUEUE} events`);
}

export default buffer;
