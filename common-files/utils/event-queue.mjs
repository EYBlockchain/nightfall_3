/* eslint import/no-extraneous-dependencies: "off" */

/**
 * If we're changing the layer 2 state, we want to make sure that we can complete
 * that change before the state is further altered by incoming events.  A good
 * example is when we are deleting the current state. If the new state gets added
 * while we're deleting, we may delete state that we didn't want deleted.
 * We achieve that here by queuing events and processing them one after the other
 * in the strict order that they are received.
 * Each event type has its own event handler function, which processes the event.
 * These functions are held in an array `eventHandlers`, which is populated in
 * `event-handlers/index.mjs` from the functions in the event-handlers directory.
 * Some events also have a 'remover' function, which is used to handle removal
 * of the event during a layer1 chain reorganisation (primarilty they delete state
 * that was removed by the chain reorg and then re-sync state from the new chain
 * fork).  These remover functions are accessed via the `.removers` property of the
 * eventHandlers array.
 * Web3js handles event removal (due to a chain reorg) by re-emitting the (now removed)
 * event with its `removed` property set to true. In the code below, we look out for
 * and catch these removals, processing them appropriately.
 */
import Queue from 'queue';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { web3 } from 'common-files/utils/contract.mjs';

const { MAX_QUEUE, CONFIRMATION_POLL_TIME, CONFIRMATIONS } = config;
const fastQueue = new Queue({ autostart: false, concurrency: 1 });
const slowQueue = new Queue({ autostart: false, concurrency: 1 });
const removed = {}; // singleton holding transaction hashes of any removed events
const stopQueue = new Queue({ autostart: false, concurrency: 1 });
export const queues = [fastQueue, slowQueue, stopQueue];

/**
This function will wait until all the functions currently in a queue have been
processed.  It's useful if you want to ensure that Nightfall has had an opportunity
to update its database with something that you know has happened on the blockchain
but that Nightfall may not have processed yet, because it's still in the event queue.
*/
function flushQueue(priority) {
  const p = new Promise(resolve => {
    queues[priority].push(cb => {
      cb(null, resolve());
    });
  });
  return p;
}

async function enqueueEvent(callback, priority, args) {
  queues[priority].push(async () => {
    return callback(args);
  });
}

/**
This function immediately and unceremoniously empties the queue. It should probably
be used with extreme care on a running queue because the exact state on emptying, and thus
the last job that ran, will be unclear. It will cause the end event to fire.
*/
function emptyQueue(priority) {
  return queues[priority].end();
}

/**
These functions pause the queue once the current process at the head of the queue has
completed.  It will then wait until we tell it to start again via unpause.
While paused, it will still accept incoming items.
*/
function pauseQueue(priority) {
  return new Promise(resolve => {
    if (queues[priority].autostart) {
      // put an event at the head of the queue which will cleanly pause it.
      queues[priority].unshift(async () => {
        queues[priority].autostart = false;
        queues[priority].stop();

        logger.info({ msg: 'Queue has been paused', priority });

        resolve();
      });
    } else {
      resolve();
    }
  });
}

function unpauseQueue(priority) {
  queues[priority].autostart = true;
  queues[priority].unshift(async () => logger.info(`queue ${priority} has been unpaused`));
}

/**
 * This function will return when the event has been on chain for <confirmations> blocks
 * It's useful to call this if you want to be sure that your event has been confirmed
 * multiple times before you go ahead and process it.
 */
function waitForConfirmation(eventObject) {
  logger.debug({ msg: 'Confirming event', event: eventObject.event });

  const { transactionHash, blockNumber } = eventObject;
  return new Promise((resolve, reject) => {
    let confirmedBlocks = 0;
    const id = setInterval(async () => {
      /*
        get the transaction that caused the event
        if it's been in a chain reorg then it will have been removed.
       */
      if (removed[transactionHash] > 0) {
        clearInterval(id);
        removed[eventObject.transactionHash]--;
        reject(
          new Error(
            `Event removed; probable chain reorg.  Event was ${eventObject.event}, transaction hash was ${transactionHash}`,
          ),
        );
      }
      const currentBlock = await web3.eth.getBlock('latest');
      if (currentBlock.number - blockNumber > confirmedBlocks) {
        confirmedBlocks = currentBlock.number - blockNumber;
      }
      if (confirmedBlocks >= CONFIRMATIONS) {
        clearInterval(id);

        logger.debug({ 
          msg: 'Event has been confirmed',
          event: eventObject.event, 
          total: currentBlock.number - blockNumber
        });

        resolve(eventObject);
      }
    }, CONFIRMATION_POLL_TIME);
  });
}

async function dequeueEvent(priority) {
  return queues[priority].shift();
}

async function queueManager(eventObject, eventArgs) {
  if (eventObject.removed) {
    /*
      in this model we don't queue removals but we can use them to reject the event
      Note the event object and its removal have the same transactionHash.
      Also note that we can get more than one removal because the event could be re-mined
      and removed again - so we need to keep count of the removals.
     */
    if (!removed[eventObject.transactionHash]) removed[eventObject.transactionHash] = 0;
    removed[eventObject.transactionHash]++; // store the removal; waitForConfirmation will read this and reject.
    return;
  }
  // First element of eventArgs must be the eventHandlers object
  const [eventHandlers, ...args] = eventArgs;
  /*
    handlers contains the functions needed to handle particular types of event,
    including removal of events when a chain reorganisation happens
   */
  if (!eventHandlers[eventObject.event]) {
    logger.debug(`Unknown event ${eventObject.event} ignored`);
    return;
  }

  // pull up the priority for the event being handled (removers have identical priority)
  const priority = eventHandlers.priority[eventObject.event];

  logger.info({
    msg: 'Queueing event', 
    event: eventObject.event, 
    transactionHash: eventObject.transactionHash,
    priority
  });

  queues[priority].push(async () => {
    // we won't even think about processing an event until it's been confirmed many times
    try {
      await waitForConfirmation(eventObject);
      return eventHandlers[eventObject.event](eventObject, args);
    } catch (err) {
      return logger.warn(err.message);
    }
  });

  // the queue shouldn't get too long if we're keeping up with the blockchain.
  if (queues[priority].length > MAX_QUEUE) {
    logger.warn({ 
      msg: 'The event queue has more events than the max configured',
      maxConfigured: MAX_QUEUE,
      totalEventsQueued: queues[priority].length
    });
  }
}

/* ignore unused exports */
export {
  flushQueue,
  enqueueEvent,
  queueManager,
  dequeueEvent,
  waitForConfirmation,
  pauseQueue,
  unpauseQueue,
  emptyQueue,
};
