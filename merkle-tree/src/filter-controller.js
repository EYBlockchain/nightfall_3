/**
@module filter-controller.js
@desc file that starts up the filter
@author iAmMichaelConnor
*/

import config from 'config';
import utilsWeb3 from './utils-web3';

import { LeafService, MetadataService } from './db/service';

// global subscriptions object:
const subscriptions = {};

// /**
// DEPRECATED - preferred using a direct event subscription rather than a 'logs' subscription.
// This function is triggered by the 'Logs' subscription, every time a new event is received via the websocket.
// @param {object} eventObject - An event object.
// */
// const newEventFromLogResponder = async (eventObject, args = {}) => {
//   // First some generic eventObject handling code:
//   console.log('\nResponding to New Event Log...');
//
//   const { decodedEventData } = eventObject;
//
//   const eventParams = config.contract.event.parameters;
//   const eventInstance = {};
//
//   // extract each relevent event parameter from the decodedEventData and add it to our eventInstance.
//   eventParams.forEach(param => {
//     eventInstance[param] = decodedEventData[param];
//   });
//
//   console.log('eventInstance:');
//   console.dir(eventInstance, { depth: null });
//
//   // Now some bespoke code; specific to our particular event:
//   // We make some hardcoded presumptions about what's contained in the 'args':
// };

/**
TODO: description
*/
const newLeafResponseFunction = async (eventObject, args) => {
  const eventName = 'newLeaf'; // hardcoded, as inextricably linked to the name of this function.
  const eventParams = config.contract.events[eventName].parameters;

  // First some generic eventObject handling code:
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
  // console.log('eventInstance:');
  // console.dir(eventInstance, { depth: null });

  // Now some bespoke code; specific to how our application needs to deal with this eventObject:
  // construct a 'leaf' document to store in the db:
  const { blockNumber } = eventData;
  const { leafIndex, leafValue } = eventInstance;
  const doc = {
    value: leafValue,
    leafIndex,
    blockNumber,
  };

  // We make some hardcoded presumptions about what's contained in the 'args':
  const { db } = args;
  const leafService = new LeafService(db);
  leafService.insertLeaf(doc); // no need to await this
};

/**
TODO: description
*/
const newLeavesResponseFunction = async (eventObject, args) => {
  const eventName = 'newLeaves'; // hardcoded, as inextricably linked to the name of this function.
  const eventParams = config.contract.events[eventName].parameters;

  // First some generic eventObject handling code:
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
  // console.log('eventInstance:');
  // console.dir(eventInstance, { depth: null });

  // Now some bespoke code; specific to how our application needs to deal with this eventObject:
  // construct an array of 'leaf' documents to store in the db:
  const { blockNumber } = eventData;
  const { minLeafIndex, leafValues } = eventInstance;

  const docs = [];
  let leafIndex;
  leafValues.forEach((leafValue, index) => {
    leafIndex = Number(minLeafIndex) + Number(index);
    const doc = {
      value: leafValue,
      leafIndex,
      blockNumber,
    };
    docs.push(doc);
  });

  // We make some hardcoded presumptions about what's contained in the 'args':
  const { db } = args;
  const leafService = new LeafService(db);
  leafService.insertLeaves(docs); // no need to await this
};

/**
This function is triggered by the 'event' contract subscription, every time a new event is received via the websocket.
@param {object} eventObject - An event object.
*/
const newEventResponder = async (eventObject, responseFunction, responseFunctionArgs = {}) => {
  console.log('\nResponding to New Event...');
  /*
    Although this function appears to be redundant (because it's passing data straight through), we retain it for the sake of example. Hopefully it demonstrates most generally how this eventResponder structure can be applied to respond to other events.
  */
  responseFunction(eventObject, responseFunctionArgs); // we don't need to await this
};

/**
Config object for the above response functions.
Naming convention:
{
  eventName: eventNameResponseFunction
}
*/
const responseFunctions = {
  newLeaf: newLeafResponseFunction,
  newLeaves: newLeavesResponseFunction,
};

/**
An 'orchestrator' which oversees the various filtering steps of the filter, before a txObject is ready to be sent to the Transaction Interpreter.
This can also be executed from the command line with:
node -e 'require("./index").filterBlock(blockNumber)'
@param {number} blockNumber
*/
async function filterBlock(db, contractInstance, fromBlock) {
  console.log(`\nsrc/filter-controller filterBlock(contractInstance, fromBlock=${fromBlock})`);

  const contractName = config.contract.name;
  const eventNames = Object.keys(config.contract.events);

  eventNames.forEach(async eventName => {
    const responder = newEventResponder;
    const responseFunction = responseFunctions[eventName];
    const responseFunctionArgs = { db };

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

  console.group(`\nStats at restart, from the merkle-tree's mongodb:`);
  console.log('latestLeaf:', latestLeaf);
  console.log('blockNumber:', blockNumber);
  console.groupEnd();

  if (blockNumber === undefined) {
    blockNumber = config.FILTER_GENESIS_BLOCK_NUMBER;
    console.log(
      `\nNo filtering history found in mongodb, so starting filter from the contract's deployment block ${blockNumber}`,
    );
  }

  const currentBlockNumber = await utilsWeb3.getBlockNumber();
  console.log(`Current blockNumber: ${currentBlockNumber}`);

  console.log(
    `\nThe filter is ${currentBlockNumber - blockNumber} blocks behind the current block.`,
  );

  return blockNumber;
}

/**
Commence filtering
*/
async function start(db, contractInstance) {
  try {
    console.log('\nStarting filter...');
    // check the fiddly case of having to re-filter any old blocks due to lost information (e.g. due to a system crash).
    const fromBlock = await getFromBlock(db); // the blockNumber we get is the next WHOLE block to start filtering.

    // Now we filter indefinitely:
    await filterBlock(db, contractInstance, fromBlock);
    return true;
  } catch (err) {
    throw new Error(err);
  }
}

export default {
  start,
};
