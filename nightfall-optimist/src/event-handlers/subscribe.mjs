/* eslint-disable no-await-in-loop */

/**
 * Module to subscribe to blockchain events
 */
import WebSocket from 'ws';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
// import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import { waitForContract } from '../../../common-files/utils/contract.mjs';

const {
  PROPOSERS_CONTRACT_NAME,
  SHIELD_CONTRACT_NAME,
  CHALLENGES_CONTRACT_NAME,
  STATE_CONTRACT_NAME,
} = constants;
const { WEBSOCKET_PORT, WEBSOCKET_PING_TIME } = config;
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
      logger.warn({ msg: 'Timed out waiting for ping response', socketName });
      ws.terminate();
    }, 2 * WEBSOCKET_PING_TIME);
  }, WEBSOCKET_PING_TIME);

  // check we received a pong in time (clears the timer set by the pinger)
  ws.on('pong', () => {
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
        logger.error({
          msg: 'Not a JSON Message',
          message,
          error,
        });
      }
    });
  });
  logger.debug('Subscribed to ProposedBlock WebSocket connection');
}
