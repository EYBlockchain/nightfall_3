/**
@module utils-web3.js
@author MichaelConnorOfficial
@desc Set of utilities to make web3 methods easier to use
*/

// First we need to connect to a websocket provider.
// Important Note: Subscribe method only works with a websocket provider!

import Web3 from 'common-files/utils/web3.mjs';
import logger from 'common-files/utils/logger.mjs';

const web3 = Web3.connection();

async function subscribeToEvent(
  contractInstance,
  eventName,
  topicFilters = null, // pass as comma separated arguments
  fromBlock = null,
) {
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

  let eventSubscription;
  if (!topicFilters) {
    eventSubscription = await contractInstance.events[eventName]({
      fromBlock,
      topics: [eventJsonInterface.signature, topicFilters],
    });
  } else {
    eventSubscription = await contractInstance.events[eventName]({
      fromBlock,
      topics: [eventJsonInterface.signature],
    });
  }

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
  eventSubscription
    .on('connected', subscriptionId => {
      logger.info(`\n\n\n\nSubscriptionId of event ${subscriptionId}`);
    })
    .on('data', eventData => {
      logger.info(`\n\n\n\n\nNew event detected named ${eventName} has been detected`);
      return eventData;
    });
  return null;
}

export default subscribeToEvent;
