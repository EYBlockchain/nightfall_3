/**
@module filter-controller.js
@desc file that starts up the filter
@author iAmMichaelConnor
*/

import config from 'config';
import Queue from 'queue';
import utilsWeb3 from './utils-web3.mjs';

import { LeafService, MetadataService } from './db/service/index.mjs';
import logger from './logger.mjs';
import mtc from './merkle-tree-controller.mjs'; // eslint-disable-line import/no-cycle
import getProposeBlockCalldata from './optimistic/process-calldata.mjs';

const ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
// global subscriptions object:
const subscriptions = {};
// this queue controls event concurrency to be 1.  This means that event
// event responders cannot attempt parallel writes to the db. Instead, such
// requests are queued and handled in order
const queue = new Queue({ autostart: true, concurrency: 1 });
/**
@author westlad
This is a response function that is able to filter data from an optimistic block
proposal and extract data that Timber's NewLeaf(s) response functions understand.  It then call them.  Doing it that way means that the smart contract
Timber is listening to does not have to emit all the commitment data in a
NewLeaf(s) event and that saves considerable gas (event emitting is not free).
*/
const blockProposedResponseFunction = async (eventObject, args) => {
  // NEW - function remains the same, for detecting single leaves, but can now specify the event name
  // NOTE - events must have same parameters as newLeaf / newLeaves
  // We make some hardcoded presumptions about what's contained in the 'args':
  logger.debug('processing BlockProposed event');
  const { db, contractName, treeId } = args;

  const eventName = args.eventName === undefined ? 'BlockProposed' : args.eventName; // hardcoded, as inextricably linked to the name of this function.

  let eventParams;
  logger.debug(`eventname: ${eventName}`);

  if (treeId === undefined || treeId === '') {
    eventParams = config.contracts[contractName].events[eventName].parameters;
  } else {
    eventParams = config.contracts[contractName].treeId[treeId].events[eventName].parameters;
  }

  // Now some generic eventObject handling code:
  const { eventData } = eventObject;

  /*
  extract each relevent event parameter from the eventData and create an eventInstance: {
    eventParamName_0: eventParamValue_0,
    eventParamName_1: eventParamValue_1,
    ...
  }
  */
  const eventInstance = {};
  eventParams.forEach(param => {
    eventInstance[param] = eventData.returnValues[param];
  });

  const metadataService = new MetadataService(db);
  const { treeHeight } = await metadataService.getTreeHeight();

  // Now some more bespoke code; specific to how our application needs to deal with this eventObject:
  // construct an array of 'leaf' documents to store in the db:
  const { blockNumber } = eventData;
  // first, we need to extract the commitment values from the calldata because
  // it's not in the emitted event.  We don't care about the Block object
  const { block, transactions } = await getProposeBlockCalldata(eventData);
  logger.debug(`recovered transactions ${JSON.stringify(transactions, null, 2)}`);
  const currentLeafCount =
    Number(block.leafCount) +
    transactions.map(t => t.commitments.filter(c => c !== ZERO)).flat(Infinity).length;
  const leafValues = transactions
    .map(transaction => transaction.commitments.filter(c => c !== config.ZERO))
    .flat(Infinity);
  // Timber works on the leafIndex BEFORE the new leafValues are added but the
  // BlockProposed event broadcasts the AFTER value:
  const minLeafIndex = currentLeafCount - leafValues.length;
  logger.debug(
    `minLeafIndex was ${minLeafIndex}, updatedLeafCount, ${currentLeafCount}, leafValues.length ${leafValues.length}, eventInstance, ${eventInstance}`,
  );
  logger.debug(`leafValues were ${JSON.stringify(leafValues, null, 2)}`);
  // now we have the relevant data, update the Merkle tree:
  if (leafValues.length === 0) return Promise.resolve();
  if (leafValues.length === 1) {
    const leaf = {
      value: leafValues[0],
      leafIndex: minLeafIndex,
      blockNumber,
    };
    const leafService = new LeafService(db);
    await leafService.insertLeaf(treeHeight, leaf);
    return mtc.update(db); // update the database to ensure we have a historic root
  }
  const leaves = [];
  let leafIndex;
  leafValues.forEach((leafValue, index) => {
    leafIndex = Number(minLeafIndex) + Number(index);
    const leaf = {
      value: leafValue,
      leafIndex,
      blockNumber,
    };
    leaves.push(leaf);
  });

  const leafService = new LeafService(db);
  await leafService.insertLeaves(treeHeight, leaves);
  return mtc.update(db); // update the database to ensure we have a historic root};
};

/**
@author westlad
This is a response function (similar to the ones below, but specific for a
rollback.  It closely follows the same format though)
*/
const rollbackResponseFunction = async (eventObject, args) => {
  // NEW - function remains the same, for detecting single leaves, but can now specify the event name
  // NOTE - events must have same parameters as newLeaf / newLeaves
  // We make some hardcoded presumptions about what's contained in the 'args':

  const { db, contractName, treeId } = args;

  const eventName = args.eventName === undefined ? 'Rollback' : args.eventName; // hardcoded, as inextricably linked to the name of this function.

  let eventParams;
  logger.debug(`eventname: ${eventName}`);

  if (treeId === undefined || treeId === '') {
    eventParams = config.contracts[contractName].events[eventName].parameters;
  } else {
    eventParams = config.contracts[contractName].treeId[treeId].events[eventName].parameters;
  }

  // Now some generic eventObject handling code:
  const { eventData } = eventObject;

  /*
  extract each relevent event parameter from the eventData and create an eventInstance: {
    eventParamName_0: eventParamValue_0,
    eventParamName_1: eventParamValue_1,
    ...
  }
  */
  const eventInstance = {};
  eventParams.forEach(param => {
    eventInstance[param] = eventData.returnValues[param];
  });
  logger.silly(`eventInstance: ${JSON.stringify(eventInstance, null, 2)}`);

  const metadataService = new MetadataService(db);
  const { treeHeight } = await metadataService.getTreeHeight();

  // Now some bespoke code; specific to how our application needs to deal with this eventObject:
  // const { blockNumber } = eventData;
  const { leafCount } = eventInstance;
  return mtc.rollback(db, treeHeight, Number(leafCount));
};

/**
TODO: description
*/
const newLeafResponseFunction = async (eventObject, args) => {
  // NEW - function remains the same, for detecting single leaves, but can now specify the event name
  // NOTE - events must have same parameters as newLeaf / newLeaves
  // We make some hardcoded presumptions about what's contained in the 'args':
  const { db, contractName, treeId } = args;

  const eventName = args.eventName === undefined ? 'NewLeaf' : args.eventName; // hardcoded, as inextricably linked to the name of this function.

  let eventParams;
  logger.debug(`eventname: ${eventName}`);

  if (treeId === undefined || treeId === '') {
    eventParams = config.contracts[contractName].events[eventName].parameters;
  } else {
    eventParams = config.contracts[contractName].treeId[treeId].events[eventName].parameters;
  }

  // Now some generic eventObject handling code:
  const { eventData } = eventObject;

  /*
  extract each relevent event parameter from the eventData and create an eventInstance: {
    eventParamName_0: eventParamValue_0,
    eventParamName_1: eventParamValue_1,
    ...
  }
  */
  const eventInstance = {};
  eventParams.forEach(param => {
    eventInstance[param] = eventData.returnValues[param];
  });
  logger.silly(`eventInstance: ${JSON.stringify(eventInstance, null, 2)}`);

  const metadataService = new MetadataService(db);
  const { treeHeight } = await metadataService.getTreeHeight();

  // Now some bespoke code; specific to how our application needs to deal with this eventObject:
  // construct a 'leaf' document to store in the db:
  const { blockNumber } = eventData;
  const { leafIndex, leafValue } = eventInstance;
  const leaf = {
    value: leafValue,
    leafIndex,
    blockNumber,
  };

  const leafService = new LeafService(db);
  await leafService.insertLeaf(treeHeight, leaf);
  return mtc.update(db); // update the database to ensure we have a historic root
};

/**
TODO: description
*/
const newLeavesResponseFunction = async (eventObject, args) => {
  // We make some hardcoded presumptions about what's contained in the 'args':
  const { db, contractName, treeId } = args;

  const eventName = args.eventName === undefined ? 'NewLeaves' : args.eventName; // hardcoded, as inextricably linked to the name of this function.

  let eventParams;

  if (treeId === undefined || treeId === '') {
    eventParams = config.contracts[contractName].events[eventName].parameters;
  } else {
    eventParams = config.contracts[contractName].treeId[treeId].events[eventName].parameters;
  }

  // Now some generic eventObject handling code:
  const { eventData } = eventObject;

  /*
  extract each relevent event parameter from the eventData and create an eventInstance: {
    eventParamName_0: eventParamValue_0,
    eventParamName_1: eventParamValue_1,
    ...
  }
  */
  const eventInstance = {};
  eventParams.forEach(param => {
    eventInstance[param] = eventData.returnValues[param];
  });
  logger.silly(`eventInstance: ${JSON.stringify(eventInstance, null, 2)}`);
  const metadataService = new MetadataService(db);
  const { treeHeight } = await metadataService.getTreeHeight();

  // Now some more bespoke code; specific to how our application needs to deal with this eventObject:
  // construct an array of 'leaf' documents to store in the db:
  const { blockNumber } = eventData;
  const { minLeafIndex, leafValues } = eventInstance;

  const leaves = [];
  let leafIndex;
  leafValues.forEach((leafValue, index) => {
    leafIndex = Number(minLeafIndex) + Number(index);
    const leaf = {
      value: leafValue,
      leafIndex,
      blockNumber,
    };
    leaves.push(leaf);
  });

  const leafService = new LeafService(db);
  await leafService.insertLeaves(treeHeight, leaves);
  return mtc.update(db); // update the database to ensure we have a historic root
};

/**
This function is triggered by the 'event' contract subscription, every time a new event is received via the websocket.
@param {object} eventObject - An event object.
*/
const newEventResponder = async (eventObject, responseFunction, responseFunctionArgs = {}) => {
  logger.debug('Responding to New Event...');

  // we can push to a queue here to buffer the events during a rollback
  // the items in the queue will execute until it's empty or we stop it
  queue.push(cb => {
    responseFunction(eventObject, responseFunctionArgs).then(() => cb());
  }); // we don't need to await this
};

/**
Config object for the above response functions.
Naming convention:
{
  eventName: eventNameResponseFunction
}
*/
export const responseFunctions = {
  NewLeaf: newLeafResponseFunction,
  NewLeaves: newLeavesResponseFunction,
  Rollback: rollbackResponseFunction,
  BlockProposed: blockProposedResponseFunction,
};

/**
An 'orchestrator' which oversees the various filtering steps of the filter
@param {number} blockNumber
*/
async function filterBlock(db, contractName, contractInstance, fromBlock, treeId) {
  logger.debug(
    `src/filter-controller filterBlock(db, contractInstance, fromBlock=${fromBlock}, treeId)`,
  );
  const metadataService = new MetadataService(db);

  let eventNames;

  // TODO: if possible, make this easier to read and follow. Fewer 'if' statements. Perhaps use 'switch' statements instead?
  if (treeId === undefined || treeId === '') {
    eventNames = Object.keys(config.contracts[contractName].events);
    if (config.treeHeight !== undefined || config.treeHeight !== '') {
      const { treeHeight } = config;
      metadataService.insertTreeHeight({ treeHeight });
    }
  } else {
    const { treeHeightDb } = await metadataService.getTreeHeight();
    const { treeHeight } = config.contracts[contractName].treeId[treeId];
    if (treeHeightDb !== treeHeight && (treeHeight !== undefined || treeHeight !== '')) {
      metadataService.insertTreeHeight({ treeHeight });
    }
    eventNames = Object.keys(config.contracts[contractName].treeId[treeId].events);
  }

  const { treeHeight } = await metadataService.getTreeHeight();
  const { latestRecalculation } = await metadataService.getLatestRecalculation();
  const { frontier } =
    latestRecalculation.frontier === undefined ? new Array(treeHeight) : latestRecalculation;
  if (frontier.length !== treeHeight + 1 && treeHeight !== 32) {
    latestRecalculation.frontier = new Array(treeHeight + 1);
    await metadataService.updateLatestRecalculation({ latestRecalculation });
  }

  eventNames.forEach(async eventName => {
    const responder = newEventResponder;
    const responseFunction = responseFunctions[eventName];
    const responseFunctionArgs = { db, contractName, eventName, treeId };

    const eventSubscription = await utilsWeb3.subscribeToEvent(
      contractName,
      contractInstance,
      null, // if null, the deployedAddress will be gleaned from the contractInstance
      eventName,
      fromBlock,
      responder,
      responseFunction,
      responseFunctionArgs,
    );

    subscriptions[eventName] = eventSubscription; // keep the subscription object for this event in global memory; to enable 'unsubscribe' in future.
  });
}

/**
Check which block was the last to be filtered.
@return {number} the next blockNumber which should be filtered.
*/
async function getFromBlock(db) {
  const metadataService = new MetadataService(db);

  const metadata = await metadataService.getLatestLeaf();

  let latestLeaf;
  let blockNumber;

  switch (metadata) {
    case null: // no document exists in the metadata db
      throw new Error('Unexpected null response from db: no document found in the metadata db.');
    default:
      latestLeaf = metadata.latestLeaf || {};
      blockNumber = latestLeaf.blockNumber || undefined;
      break;
  }

  logger.info(
    `Stats at restart, from the merkle-tree's mongodb: latestLeaf, ${latestLeaf}; blockNumber, ${blockNumber}`,
  );

  if (blockNumber === undefined) {
    blockNumber = config.FILTER_GENESIS_BLOCK_NUMBER;
    logger.warn(
      `No filtering history found in mongodb, so starting filter from the contract's deployment block ${blockNumber}`,
    );
  }

  const currentBlockNumber = await utilsWeb3.getBlockNumber();
  logger.info(`Current blockNumber: ${currentBlockNumber}`);

  logger.info(`The filter is ${currentBlockNumber - blockNumber} blocks behind the current block.`);

  return blockNumber;
}

/**
Commence filtering
*/
async function start(db, contractName, contractInstance, treeId) {
  try {
    logger.info('Starting filter...');
    // check the fiddly case of having to re-filter any old blocks due to lost information (e.g. due to a system crash).
    const fromBlock = await getFromBlock(db); // the blockNumber we get is the next WHOLE block to start filtering.

    // Now we filter indefinitely:
    await filterBlock(db, contractName, contractInstance, fromBlock, treeId);
    return true;
  } catch (err) {
    logger.error(err.stack);
    throw new Error(err);
  }
}

/**
Many functions need to be sure that the database is current.  If it's
potentially in the process of updating (i.e. an event responder is running)
then these functions will want to hang on for a bit.  Hence this function:
*/
function waitForUpdatesToComplete() {
  return new Promise((resolve, reject) => {
    //    queue.once('end', () => {
    //      logger.debug('queue emptied');
    //      resolve();
    //    });
    // we'll push in this dummy function. This ensures that there is at least
    // one function in the queue, when it clear the queue, the 'end' event will
    // fire.  You'd think you could use queue.length == 0 as a test but that
    // doesn't seem to work.
    queue.push(cb => {
      resolve();
      logger.debug('queued events have run');
      cb();
    });
    setTimeout(() => reject(new Error('Waiting too long for queue to empty')), 1000);
  });
}

export default {
  start,
  waitForUpdatesToComplete,
};
