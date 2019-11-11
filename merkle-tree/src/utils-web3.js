/**
@module utils-web3.js
@author MichaelConnorOfficial
@desc Set of utilities to make web3 methods easier to use
*/

// First we need to connect to a websocket provider.
// Important Note: Subscribe method only works with a websocket provider!

import Web3 from './web3';

const web3 = Web3.connect();

// global subscription objects, to help us unsubscribe easily:
let newBlockHeadersSubscription = {};
let syncingSubscription = {};
// event subscriptions are more bespoke (less universal) and so are intended to be handled by the calling module instead.

// GETTERS!!!

/**
@returns {Number} Returns the current block number.
*/
async function getBlockNumber() {
  const blockNumber = await web3.eth.getBlockNumber();
  return blockNumber;
}

/**
Returns a block matching the block number or block hash.
@param {String|Number} blockHashOrBlockNumber The block number or block hash. Or the string "genesis", "latest" or "pending" as in the default block parameter.
@param {Boolean} returnTransactionObjects - (optional, default false) If true, the returned block will contain all transactions as objects, if false it will only contains the transaction hashes.
@returns {Object} Block. Returns a block matching the block number or block hash.
*/
async function getBlock(blockHashOrBlockNumber, returnTransactionObjects) {
  const block = await web3.eth.getBlock(blockHashOrBlockNumber, returnTransactionObjects);
  return block;
}

/**
Returns a block matching the block number or block hash.
@param {String|Number} blockHashOrBlockNumber The block number or block hash. Or the string "genesis", "latest" or "pending" as in the default block parameter.
@returns {Number} Returns the number of transactions in a given block.
*/
async function getBlockTransactionCount(blockHashOrBlockNumber) {
  const blockTxCount = await web3.eth.getBlockTransactionCount(blockHashOrBlockNumber);
  return blockTxCount;
}

/**
Returns a block matching the block number or block hash.
@param {String|Number} hashStringOrNumber A block number or hash. Or the string "genesis", "latest" or "pending" as in the default block parameter.
@param {Number} indexNumber - The transactions index position.
@returns {Object} Returns a transaction object based on a block hash or number and the transactions index position.
*/
async function getTransactionFromBlock(hashStringOrNumber, indexNumber) {
  console.log(`\nGetting transaction ${indexNumber} from Block ${hashStringOrNumber}`);

  const txObject = await web3.eth.getTransactionFromBlock(hashStringOrNumber, indexNumber);

  console.log('txObject.input:');
  console.log(txObject.input);

  return txObject;
}

// NEW BLOCK HEADERS!!!

/**
web3.eth.subscribe
Parameters:
  1. String - The subscription 'type' you want to subscribe to (one of:
    {
      'pendingTransactions',
      'newBlockHeaders',
      'syncing',
      'logs'
    } - 'logs' is by far the most useful for us!!)
  2. Mixed - (optional) Optional additional parameters, depending on the subscription type (only relevant for the 'logs' subscription type).
    For 'logs' subscription type, the subscription options are:
      {fromBlock, // Number: The number of the earliest block. By default null.
      address, // String|Array: An address or a list of addresses to only get logs from particular account(s).
      topics, // Array: An array of values which must each appear in the log entries. The order is important. If you want to leave topics out use null, e.g. [null, '0x00...']. You can also pass another array for each topic with options for that topic e.g. [null, ['option1', 'option2']]
  3. Function - (optional) Optional callback, returns an ERROR object as first parameter and the RESULT as second. Will be called for each incoming subscription, and the subscription itself as 3rd parameter.

Returns:
  EventEmitter: A subscription instance (see below for what a subscription instance object looks like) as an event emitter with the following properties:
    * "data" returns Object: Fires on each incoming log with the log object as argument (see below for what a log object looks like)
    * "changed" returns Object: Fires on each log which was removed from the blockchain. The log will have the additional property "removed: true".
    * "error" returns Object: Fires when an error in the subscription occurs.
    For the structure of a returned event Object see web3.eth.getPastEvents return values.

  Notification returns
    1. Object|Null - First parameter is an error object if the subscription failed.
    2. Object - The log object like in web3.eth.getPastEvents return values.
*/

/**
Subscribes to New Block Headers as they are mined.
@returns {object} a promise which resolves to a 'Block' object:
Promise<object> - The block object:

number - Number: The block number. null when its pending block.
hash 32 Bytes - String: Hash of the block. null when its pending block.
parentHash 32 Bytes - String: Hash of the parent block.
nonce 8 Bytes - String: Hash of the generated proof-of-work. null when its pending block.
sha3Uncles 32 Bytes - String: SHA3 of the uncles data in the block.
logsBloom 256 Bytes - String: The bloom filter for the logs of the block. null when its pending block.
transactionsRoot 32 Bytes - String: The root of the transaction trie of the block
stateRoot 32 Bytes - String: The root of the final state trie of the block.
receiptsRoot 32 Bytes - String: Transaction receipts are used to store the state after a transaction has been executed and are kept in an index-keyed trie. The hash of its root is placed in the block header as the receipts root.
miner - String: The address of the beneficiary to whom the mining rewards were given.
difficulty - String: Integer of the difficulty for this block.
totalDifficulty - String: Integer of the total difficulty of the chain until this block.
extraData - String: The “extra data” field of this block.
size - Number: Integer the size of this block in bytes.
gasLimit - Number: The maximum gas allowed in this block.
gasUsed - Number: The total used gas by all transactions in this block.
timestamp - Number | String: The unix timestamp for when the block was collated (returns a string if a overflow got detected).
transactions - Array: Array of transaction objects, or 32 Bytes transaction hashes depending on the returnTransactionObjects parameter.
uncles - Array: Array of uncle hashes.
*/
async function subscribeToNewBlockHeaders(responder) {
  console.log('\nSUBSCRIBING to New Block Headers...');

  newBlockHeadersSubscription = await web3.eth.subscribe('newBlockHeaders');

  newBlockHeadersSubscription.on('data', blockHeader => {
    console.log('\n\n\n\n\n\n\nNEW BLOCK HEADER RECEIVED!');
    // console.log(blockHeader);

    responder(blockHeader);
  });

  newBlockHeadersSubscription.on('error', error => {
    throw new Error(error);
  });

  return newBlockHeadersSubscription;
}

/**
Unsubscribe from New Block Headers
*/
async function unsubscribeFromNewBlockHeaders() {
  console.log('\nUNSUBSCRIBING from New Block Data...');
  if (!newBlockHeadersSubscription) {
    console.log('\nThere is nothing to unsubscribe from');
    return;
  }
  console.log(newBlockHeadersSubscription);
  // unsubscribes the subscription
  await newBlockHeadersSubscription.unsubscribe((error, success) => {
    console.log("We're in subscription.unsubscribe", error, success);
    if (success) {
      console.log('Successfully unsubscribed!');
    }
    if (error) {
      throw new Error(error);
    }
  });
}

// SYNCING

/**
Subscribe to syncing events. This will return an object when the node is syncing and when its finished syncing will return FALSE.
Syncing object example:
{
    startingBlock: 100,
    currentBlock: 312,
    highestBlock: 512,
    knownStates: 234566,
    pulledStates: 123455
}
*/
async function subscribeToSyncing() {
  console.log('\nSUBSCRIBING to Syncing data...');

  syncingSubscription = await web3.eth.subscribe('syncing');

  console.log(syncingSubscription);

  syncingSubscription.on('data', sync => {
    console.log('\n\n\n\n\nNew Syncing data received!');
    console.log(sync);

    // responder(sync);
  });

  syncingSubscription.on('changed', isSyncing => {
    if (isSyncing) {
      // stop app operation
      console.log('isSyncing = true');
      // unsubscribeFromNewBlockHeaders();
    } else {
      // regain app operation
      // subscribeToNewBlockHeaders();
      console.log('isSyncing = false');
    }
  });

  syncingSubscription.on('error', error => {
    throw new Error(error);
  });

  return syncingSubscription;
}

/**
Unsubscribe from Syncing data
*/
async function unsubscribeFromSyncing() {
  console.log('\nUNSUBSCRIBING from Syncing data...');
  if (!syncingSubscription) {
    console.log('\nThere is nothing to unsubscribe from');
    return;
  }
  console.log(syncingSubscription);
  // unsubscribes the subscription
  await syncingSubscription.unsubscribe((error, success) => {
    console.log("We're in subscription.unsubscribe", error, success);
    if (success) {
      console.log('Successfully unsubscribed!');
    }
    if (error) {
      throw new Error(error);
    }
  });
}

// EVENTS!!!

// a list for saving subscribed event instances
let events = {};

function getContractInterface(contractName) {
  console.log(`./src/utils-web3 getContractInterface(${contractName})`);

  const path = `../build/contracts/${contractName}.json`;
  const contractInterface = require(path); // eslint-disable-line global-require, import/no-dynamic-require
  console.log('\ncontractInterface:');
  console.log(contractInterface);
  return contractInterface;
}

// returns a web3 contract instance (as opposed to a truffle-contract instance)
function getContractInstance(contractName, deployedAddress) {
  console.log(`./src/utils-web3 getContractInterface(${contractName}, ${deployedAddress})`);
  const contractInterface = getContractInterface(contractName);
  let contractInstance;

  if (!deployedAddress) {
    contractInstance = new web3.eth.Contract(contractInterface.abi);
  } else {
    contractInstance = new web3.eth.Contract(contractInterface.abi, deployedAddress);
  }
  console.log('\ncontractInstance:');
  console.log(contractInstance);
  return contractInstance;
}

/**
web3.eth.abi.decodeLog(inputs, hexString, topics);
Decodes ABI encoded log data and indexed topic data.

Parameters
1. inputs - Array: A JSON interface inputs array. See the solidity documentation for a list of types.
2. hexString - String: The ABI byte code in the data field of a log.
3. topics - Array: An array with the index parameter topics of the log, without the topic[0] if its a non-anonymous event, otherwise with topic[0].

Returns
Object - The result object containing the decoded parameters.
E.g.
Result {
'0': '0xff',
'1': '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
'2': '123456789',
__length__: 3,
bytes1Value: '0xff',
bytes32Value: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
uint256Value: '123456789' }
*/
function decodeEventData(eventData, eventJsonInterface) {
  // We remove the 1st topic from the topics array when we use non-anonymous events.
  const topics =
    eventJsonInterface.anonymous === false ? eventData.topics.slice(1) : eventData.topics;

  const decodedEventData = web3.eth.abi.decodeLog(
    eventJsonInterface.inputs,
    eventData.data,
    topics,
  );

  return decodedEventData;
}

function addNewEventFromLogs(eventObject) {
  const { blockNumber } = eventObject.encodedEventData;
  const { address } = eventObject.encodedEventData;
  const eventName = eventObject.eventJsonInterface.name;

  events[address] = events[address] === undefined ? {} : events[address];

  events[address][eventName] =
    events[address][eventName] === undefined ? {} : events[address][eventName];

  events[address][eventName][blockNumber] =
    events[address][eventName][blockNumber] === undefined
      ? []
      : events[address][eventName][blockNumber];

  events[address][eventName][blockNumber].push(eventObject);

  return events;
}

/**
DEPRECATED in favour of subscribing to events (rather than subscribing to events via logs)
*/
async function subscribeToEventViaLogs(
  contractName,
  contractInstance,
  deployedAddress,
  eventName,
  fromBlock = null,
  responderFunction,
  responderFunctionArgs = {},
) {
  console.log(`\nSubscribing to event via logs...`);
  console.log(`contractName`, contractName);
  console.log(`contractInstance:`, contractInstance);
  console.log(`deployedAddress`, deployedAddress);
  console.log(`eventName`, eventName);
  console.log(`fromBlock`, fromBlock);
  console.log(`responderFunction`, responderFunction);

  if (!contractInstance) {
    contractInstance = getContractInstance(contractName, deployedAddress); // eslint-disable-line no-param-reassign
  } else {
    deployedAddress = contractInstance._address; // eslint-disable-line no-param-reassign, no-underscore-dangle
  }

  /*
  We use the eventJsonInterface to extract the event's topic signature, in order to subscribe.

  eventJsonInterface object example:
  { anonymous: false,
    inputs:
     [ { indexed: true, name: 'myEventParam1', type: 'uint256' },
       { indexed: true, name: 'myEventParam2', type: 'bytes32' },
       { indexed: true, name: 'myEventParam3', type: 'address' },
       { indexed: false, name: 'myEventParam4', type: 'bytes1' },
       { indexed: false,
         name: 'myEventParam5',
         type: 'uint256[]' } ],
    name: 'MyEventName',
    type: 'event',
    signature: '0x881cc8af0159324ccea314ad98a0cf26fe0e460c2afa693c92f591613d4de7b2' }
  */
  const eventJsonInterface = web3.utils._.find(
    contractInstance._jsonInterface, // eslint-disable-line no-underscore-dangle
    o => o.name === eventName && o.type === 'event',
  );

  // console.log("\neventJsonInterface")
  // console.log(eventJsonInterface)

  const eventSubscription = await web3.eth.subscribe('logs', {
    fromBlock,
    address: contractInstance.options.address,
    topics: [eventJsonInterface.signature],
  });

  /* eventData output example:
    [{
    data: '0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385',
    topics: ['0xfd43ade1c09fade1c0d57a7af66ab4ead7c2c2eb7b11a91ffdd57a7af66ab4ead7', '0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385']
    logIndex: 0,
    transactionIndex: 0,
    transactionHash: '0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385',
    blockHash: '0xfd43ade1c09fade1c0d57a7af66ab4ead7c2c2eb7b11a91ffdd57a7af66ab4ead7',
    blockNumber: 1234,
    address: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe'
    },{...}]
  */
  eventSubscription.on('data', eventData => {
    console.log('\n\n\nNew', contractName, eventName, 'event detected');
    console.log('\nEncoded Event Data:');
    console.log(eventData);

    // let's decode the 'eventData':
    const decodedEventData = decodeEventData(eventData, eventJsonInterface);
    console.log(`\nDecoded Event Data:`);
    console.log(decodedEventData);

    const eventObject = {
      encodedEventData: eventData,
      decodedEventData,
      eventJsonInterface,
    };

    // let's add the eventObject to the list of events:
    events = addNewEventFromLogs(eventObject, events);

    console.log('\nevents');
    console.dir(events, { depth: null });

    responderFunction(eventObject, responderFunctionArgs);
  });

  console.log("Here's the subscription object for", contractName, eventName);
  console.log(eventSubscription);
  return eventSubscription;
}

function addNewEvent(eventObject) {
  const { blockNumber } = eventObject.eventData;
  const { address } = eventObject.eventData;
  const eventName = eventObject.eventData.event;

  events[address] = events[address] === undefined ? {} : events[address];

  events[address][eventName] =
    events[address][eventName] === undefined ? {} : events[address][eventName];

  events[address][eventName][blockNumber] =
    events[address][eventName][blockNumber] === undefined
      ? []
      : events[address][eventName][blockNumber];

  events[address][eventName][blockNumber].push(eventObject);

  return events;
}

async function subscribeToEvent(
  contractName,
  contractInstance,
  deployedAddress,
  eventName,
  fromBlock = null,
  responder,
  responseFunction,
  responseFunctionArgs = {},
) {
  console.log(`\nSubscribing to event...`);
  console.log(`contractName`, contractName);
  // console.log(`contractInstance:`, contractInstance);
  console.log(`deployedAddress`, deployedAddress);
  console.log(`eventName`, eventName);
  console.log(`fromBlock`, fromBlock);
  // console.log(`responder`, responder);
  // console.log(`responseFunction`, responseFunction);
  // console.log(`responseFunctionArgs`, responseFunctionArgs);

  if (!contractInstance) {
    console.log(
      `Contract instance not provided. Generating a contractInstance from the contractName and deployedAddress...`,
    );
    contractInstance = getContractInstance(contractName, deployedAddress); // eslint-disable-line no-param-reassign
  } else {
    console.log(`Contract instance provided.`);
    deployedAddress = contractInstance._address; // eslint-disable-line no-param-reassign, no-underscore-dangle
  }

  /*
  We use the eventJsonInterface to extract the event's topic signature, in order to subscribe.

  eventJsonInterface object example:
  { anonymous: false,
    inputs:
     [ { indexed: true, name: 'myEventParam1', type: 'uint256' },
       { indexed: true, name: 'myEventParam2', type: 'bytes32' },
       { indexed: true, name: 'myEventParam3', type: 'address' },
       { indexed: false, name: 'myEventParam4', type: 'bytes1' },
       { indexed: false,
         name: 'myEventParam5',
         type: 'uint256[]' } ],
    name: 'MyEventName',
    type: 'event',
    signature: '0x881cc8af0159324ccea314ad98a0cf26fe0e460c2afa693c92f591613d4de7b2' }
  */
  const eventJsonInterface = web3.utils._.find(
    contractInstance._jsonInterface, // eslint-disable-line no-underscore-dangle
    o => o.name === eventName && o.type === 'event',
  );

  // console.log("\neventJsonInterface")
  // console.log(eventJsonInterface)

  const eventSubscription = await contractInstance.events[eventName]({
    fromBlock,
    topics: [eventJsonInterface.signature],
  });

  /* eventData example
    {
      returnValues: {
          myIndexedParam: 20,
          myOtherIndexedParam: '0x123456789...',
          myNonIndexParam: 'My String'
      },
      raw: {
          data: '0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385',
          topics: ['0xfd43ade1c09fade1c0d57a7af66ab4ead7c2c2eb7b11a91ffdd57a7af66ab4ead7', '0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385']
      },
      event: 'MyEvent',
      signature: '0xfd43ade1c09fade1c0d57a7af66ab4ead7c2c2eb7b11a91ffdd57a7af66ab4ead7',
      logIndex: 0,
      transactionIndex: 0,
      transactionHash: '0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385',
      blockHash: '0xfd43ade1c09fade1c0d57a7af66ab4ead7c2c2eb7b11a91ffdd57a7af66ab4ead7',
      blockNumber: 1234,
      address: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe'
    }
  */
  eventSubscription.on('data', eventData => {
    console.log('\n\n\n\n\nNew', contractName, eventName, 'event detected');
    // console.log('\nEvent Data:');
    // console.log(eventData);

    const eventObject = {
      eventData,
      eventJsonInterface,
    };

    // let's add the eventObject to the list of events:
    events = addNewEvent(eventObject, events);

    // console.log('\nevents');
    // console.dir(events, { depth: null });

    responder(eventObject, responseFunction, responseFunctionArgs);
  });

  // console.log("Here's the subscription object for", contractName, eventName);
  // console.log(eventSubscription);
  return eventSubscription;
}

async function unsubscribe(subscription) {
  console.log('\nUNSUBSCRIBING...');
  if (!subscription) {
    console.log('\nThere is nothing to unsubscribe from');
    return;
  }
  console.log(subscription);
  // unsubscribes the subscription
  await subscription.unsubscribe((error, success) => {
    console.log("we're in subscription.unsubscribe", error, success);
    if (success) {
      console.log('Successfully unsubscribed!');
    }
    if (error) {
      throw new Error(error);
    }
  });
}

export default {
  getBlockNumber,
  getBlock,
  getBlockTransactionCount,
  getTransactionFromBlock,
  subscribeToNewBlockHeaders,
  unsubscribeFromNewBlockHeaders,
  subscribeToSyncing,
  unsubscribeFromSyncing,
  getContractInterface,
  getContractInstance,
  subscribeToEventViaLogs,
  subscribeToEvent,
  unsubscribe,
  decodeEventData,
};
