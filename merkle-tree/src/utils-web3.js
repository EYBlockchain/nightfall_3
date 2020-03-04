/**
@module utils-web3.js
@author MichaelConnorOfficial
@desc Set of utilities to make web3 methods easier to use
*/

// First we need to connect to a websocket provider.
// Important Note: Subscribe method only works with a websocket provider!

import Web3 from './web3';

const web3 = Web3.connect();

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

  const txReceipt = await web3.eth.getTransactionFromBlock(hashStringOrNumber, indexNumber);

  console.log('txReceipt.input:');
  console.log(txReceipt.input);

  return txReceipt;
}

// EVENTS!!!

// a list for saving subscribed event instances
let events = {};

function getContractInterface(contractName) {
  console.log(`\n./src/utils-web3 getContractInterface(${contractName})`);

  const path = `../build/contracts/${contractName}.json`;
  const contractInterface = require(path); // eslint-disable-line global-require, import/no-dynamic-require
  // console.log('\ncontractInterface:');
  // console.log(contractInterface);
  return contractInterface;
}

async function getContractAddress(contractName) {
  console.log(`\n./src/utils-web3 getContractAddress(${contractName})`);
  let deployedAddress;
  const contractInterface = getContractInterface(contractName);

  const networkId = await web3.eth.net.getId();
  console.log('networkId:', networkId);

  if (contractInterface && contractInterface.networks && contractInterface.networks[networkId]) {
    deployedAddress = contractInterface.networks[networkId].address;
  }

  console.log('deployed address:', deployedAddress);

  return deployedAddress;
}

// returns a web3 contract instance (as opposed to a truffle-contract instance)
async function getContractInstance(contractName, deployedAddress) {
  console.log(`\n./src/utils-web3 getContractInstance(${contractName}, ${deployedAddress})`);

  // interface:
  const contractInterface = getContractInterface(contractName);

  // address:
  // eslint-disable-next-line no-param-reassign
  if (!deployedAddress) deployedAddress = await getContractAddress(contractName);

  // instance:
  let contractInstance;

  if (!deployedAddress) {
    contractInstance = new web3.eth.Contract(contractInterface.abi);
  } else {
    contractInstance = new web3.eth.Contract(contractInterface.abi, deployedAddress);
  }
  // console.log('\ncontractInstance:');
  // console.log(contractInstance);
  return contractInstance;
}

// returns a web3 contract instance (rather than a truffle-contract instance)
function getContractBytecode(contractName) {
  const contractInterface = getContractInterface(contractName);
  const { bytecode } = contractInterface;
  // console.log('\nbytecode:');
  // console.log(bytecode);
  return bytecode;
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
  console.log(`eventName`, eventName);
  console.log(`fromBlock`, fromBlock);

  if (!contractInstance) {
    console.log(
      `Contract instance not provided. Generating a contractInstance from the contractName ${contractName} and deployedAddress ${deployedAddress}...`,
    );
    contractInstance = getContractInstance(contractName, deployedAddress); // eslint-disable-line no-param-reassign
  } else {
    console.log(`Contract instance provided.`);
    deployedAddress = contractInstance._address; // eslint-disable-line no-param-reassign, no-underscore-dangle
    console.log(deployedAddress);
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
  console.log('\nUnsubscribing...');
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
  getContractInterface,
  getContractAddress,
  getContractInstance,
  getContractBytecode,
  subscribeToEvent,
  unsubscribe,
};
