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
const fastQueue = new Queue({ autostart: true, concurrency: 1 });
const slowQueue = new Queue({ autostart: true, concurrency: 1 });
const queues = [fastQueue, slowQueue];

/**
This function will return a promise that resolves to true when the next highest
priority queue is empty (priority goes in reverse order, prioity 0 is highest
priority)
*/
export function nextHigherPriorityQueueHasEmptied(priority) {
  return new Promise(resolve => {
    const listener = () => resolve();
    if (priority === 0) resolve(); // resolve if we're the highest priority queue
    queues[priority - 1].once('end', listener); // or when the higher priority queue empties
    if (queues[priority - 1].length === 0) {
      queues[priority - 1].removeListener('end', listener);
      resolve(); // or if it's already empty
    }
  });
}

/*
This function pauses the queues but it will also wait until any running
handler that has reached the front of the queue terminates before it resolves
so that you can be sure all queue activity has ceased.
*/
export async function pauseEventQueues() {
  // make a promise for each queue which resolves when the queue is paused
  return Promise.all(
    queues.map(
      (q, i) =>
        new Promise(resolve =>
          // put this at the front of the queue:
          q.unshift(async () => {
            q.autostart = false; // eslint-disable-line no-param-reassign
            q.stop(); // stop the queue this function was in
            logger.debug(`Queue ${i} paused`);
            // when this resolves, we know that the last queued event (this function) has run
            // and no others are running because the concurrency is 1. This function called
            // a stop on the queue so no new queued events can now run.  All is silence.
            resolve();
          }),
        ),
    ),
  );
}

export function resumeEventQueues() {
  queues.forEach(q => {
    q.autostart = true; // eslint-disable-line no-param-reassign
    q.start();
  });
}

export async function queueManager(eventObject, eventArgs) {
  // First element of eventArgs must be the eventHandlers object
  const [eventHandlers, ...args] = eventArgs;
  // handlers contains the functions needed to handle particular types of event,
  // including removal of events when a chain reorganisation happens
  if (!eventHandlers[eventObject.event]) {
    logger.debug(`Unknown event ${eventObject.event} ignored`);
    return;
  }
  // pull up the priority for the event being handled (removers have identical priority)
  const priority = eventHandlers.priority[eventObject.event];
  // if the event was removed then we have a chain reorg and need to reset our
  // layer 2 state accordingly.
  if (eventObject.removed) {
    if (!eventHandlers.removers[eventObject.event]) {
      logger.debug(`Unknown event removal ${eventObject.event} ignored`);
      return;
    }
    logger.info(`Queueing event removal ${eventObject.event}`);
    queues[priority].push(async () => {
      await nextHigherPriorityQueueHasEmptied(priority); // prevent eventHandlers running until the higher priority queue has emptied
      eventHandlers.removers[eventObject.event](eventObject, args);
    });
    // otherwise queue the event for processing.
  } else {
    logger.info(`Queueing event ${eventObject.event}`);
    queues[priority].push(async () => {
      await nextHigherPriorityQueueHasEmptied(priority); // prevent eventHandlers running until the higher priority queue has emptied
      eventHandlers[eventObject.event](eventObject, args);
    });
  }
  // the queue shouldn't get too long if we're keeping up with the blockchain.
  if (queues[priority].length > MAX_QUEUE)
    logger.warn(`The event queue has more than ${MAX_QUEUE} events`);
}
