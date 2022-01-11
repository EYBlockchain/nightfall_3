/* eslint import/no-extraneous-dependencies: "off" */

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
import { web3 } from 'common-files/utils/contract.mjs';

const { MAX_QUEUE, CONFIRMATION_POLL_TIME, CONFIRMATIONS } = config;
const fastQueue = new Queue({ autostart: true, concurrency: 1 });
const slowQueue = new Queue({ autostart: true, concurrency: 1 });
export const queues = [fastQueue, slowQueue];

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
This function will return when the event has been on chain for <confirmations> blocks
It's useful to call this if you want to be sure that your event has been confirmed
multiple times before you go ahead and process it.
*/

function waitForConfirmation(eventObject) {
  logger.debug(`Confirming event ${eventObject.event}`);
  const { transactionHash, blockNumber } = eventObject;
  return new Promise((resolve, reject) => {
    let confirmedBlocks = 0;
    const id = setInterval(async () => {
      const tx = await web3.eth.getTransaction(transactionHash);
      if (tx.blockNumber === null || tx.blockNumber !== blockNumber) {
        clearInterval(id);
        reject(
          new Error(
            'The original block in which this event was created no longer exists - probable chain reorg',
          ),
        );
      }
      const currentBlock = await web3.eth.getBlock('latest');
      if (currentBlock.number - blockNumber > confirmedBlocks) {
        confirmedBlocks = currentBlock.number - blockNumber;
      }
      if (confirmedBlocks >= CONFIRMATIONS) {
        clearInterval(id);
        logger.debug(
          `Event ${eventObject.event} has been confirmed ${
            currentBlock.number - blockNumber
          } times`,
        );
        resolve(eventObject);
      }
    }, CONFIRMATION_POLL_TIME);
  });
}

async function queueManager(eventObject, eventArgs) {
  if (eventObject.removed) return; // in this model we don't process removals
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
  logger.info(`Queueing event ${eventObject.event}`);
  queues[priority].push(async () => {
    // we won't even think about processing an event until it's been confirmed many times
    try {
      await waitForConfirmation(eventObject);
      return eventHandlers[eventObject.event](eventObject, args);
    } catch (err) {
      return logger.warn(err.message);
    }
  });
  // }
  // the queue shouldn't get too long if we're keeping up with the blockchain.
  if (queues[priority].length > MAX_QUEUE)
    logger.warn(`The event queue has more than ${MAX_QUEUE} events`);
}

/* ignore unused exports */
export { flushQueue, enqueueEvent, queueManager, waitForConfirmation };
