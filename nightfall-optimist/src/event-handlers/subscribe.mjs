/* eslint-disable no-await-in-loop */

/**
 * Module to subscribe to blockchain events
 */
import WebSocket from 'ws';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { getContractInstance, getContractAddress } from 'common-files/utils/contract.mjs';
import constants from 'common-files/constants/index.mjs';

const {
  PROPOSERS_CONTRACT_NAME,
  SHIELD_CONTRACT_NAME,
  CHALLENGES_CONTRACT_NAME,
  STATE_CONTRACT_NAME,
} = constants;
const { RETRIES, WEBSOCKET_PORT, WEBSOCKET_PING_TIME } = config;
const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });

/**
 * Function that does some standardised setting up of a websocket's events.
 * It logs open, close and error events, sets up a ping and logs the pong. It will
 * close the socket on pong failure.  The user is expected to handle the reconnect.
 * It does not set up the onmessage event because this tends to be case-specific.
 */
function setupWebsocketEvents(ws, socketName) {
  let timeoutID;
  // setup a pinger to ping the websocket correspondent
  const intervalID = setInterval(() => {
    ws.ping();
    // set up a timeout - will close the websocket, which will trigger a reconnect
    timeoutID = setTimeout(() => {
      logger.warn({ message: 'Timed out waiting for ping response', socketName });
      ws.terminate();
    }, 2 * WEBSOCKET_PING_TIME);
  }, WEBSOCKET_PING_TIME);

  // check we received a pong in time (clears the timer set by the pinger)
  ws.on('pong', () => {
    // logger.debug(`Got pong from ${socketName} websocket`);
    clearTimeout(timeoutID);
  });
  ws.on('error', () => {
    logger.debug(`ERROR ${socketName}`);
  });
  ws.on('open', () => {
    logger.debug(`OPEN ${socketName}`);
  });
  ws.on('close', err => {
    logger.debug(`CLOSE ${socketName} ${err}`);
    clearInterval(intervalID);
  });
}

/**
 * Function that tries to get a (named) contract instance and, if it fails, will
 * retry after 3 seconds.  After RETRIES attempts, it will give up and throw.
 * This is useful in case nightfall-optimist comes up before the contract
 * is fully deployed.
 */
export async function waitForContract(contractName) {
  let errorCount = 0;
  let error;
  let instance;
  while (errorCount < RETRIES) {
    try {
      error = undefined;
      const address = await getContractAddress(contractName);

      if (address === undefined) 
        throw new Error(`${contractName} contract address was undefined`);

      instance = getContractInstance(contractName, address);

      return instance;
    } catch (err) {
      error = err;
      errorCount++;

      logger.warn({ message: 'Unable to get a contract instance will try again in 3 secs', contractName });

      await new Promise(resolve => setTimeout(() => resolve(), 3000));
    }
  }
  if (error) throw error;
  return instance;
}

/**
 *
 * @param callback - The function that distributes events to the event-handler function
 * @param arg - List of arguments to be passed to callback, the first element must be the event-handler functions
 * @returns = List of emitters from each contract.
 */
export async function startEventQueue(callback, ...arg) {
  const contractNames = [
    STATE_CONTRACT_NAME,
    SHIELD_CONTRACT_NAME,
    CHALLENGES_CONTRACT_NAME,
    PROPOSERS_CONTRACT_NAME,
  ];
  const contracts = await Promise.all(contractNames.map(c => waitForContract(c)));
  const emitters = contracts.map(e => {
    const emitterC = e.events.allEvents();
    emitterC.on('changed', event => callback(event, arg));
    emitterC.on('data', event => callback(event, arg));
    return emitterC;
  });
  logger.debug('Subscribed to layer 2 state events');
  return emitters;
}

export async function subscribeToChallengeWebSocketConnection(callback, ...args) {
  wss.on('connection', ws => {
    ws.on('message', message => {
      if (message === 'challenge') {
        setupWebsocketEvents(ws, 'challenge');
        callback(ws, args);
      }
    });
  });
  logger.debug('Subscribed to Challenge WebSocket connection');
}

export async function subscribeToBlockAssembledWebSocketConnection(callback, ...args) {
  wss.on('connection', ws => {
    ws.on('message', message => {
      if (message === 'blocks') {
        setupWebsocketEvents(ws, 'proposer');
        callback(ws, args);
      }
    });
  });
  logger.debug('Subscribed to BlockAssembled WebSocket connection');
}

export async function subscribeToInstantWithDrawalWebSocketConnection(callback, ...args) {
  wss.on('connection', ws => {
    ws.on('message', message => {
      if (message === 'instant') {
        setupWebsocketEvents(ws, 'liquidity provider');
        callback(ws, args);
      }
    });
  });
  logger.debug('Subscribed to InstantWithDrawal WebSocket connection');
}

export async function subscribeToProposedBlockWebSocketConnection(callback, ...args) {
  wss.on('connection', ws => {
    ws.on('message', message => {
      try {
        if (JSON.parse(message).type === 'sync') {
          logger.info(`Subscribing to ProposedBlock`);

          setupWebsocketEvents(ws, 'publisher');
          callback(ws, args);
        }
      } catch (error) {
        logger.debug('Not JSON Message');
      }
    });
  });
  logger.debug('Subscribed to ProposedBlock WebSocket connection');
}
