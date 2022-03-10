/* eslint-disable no-await-in-loop */

/**
 * Module to subscribe to blockchain events
 */
import WebSocket from 'ws';
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { getContractInstance, getContractAddress } from 'common-files/utils/contract.mjs';

const {
  PROPOSERS_CONTRACT_NAME,
  SHIELD_CONTRACT_NAME,
  RETRIES,
  WEBSOCKET_PORT,
  CHALLENGES_CONTRACT_NAME,
  STATE_CONTRACT_NAME,
} = config;
const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });

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
      logger.debug(`${contractName} contract address is ${address}`);
      if (address === undefined) throw new Error(`${contractName} contract address was undefined`);
      instance = getContractInstance(contractName, address);
      return instance;
    } catch (err) {
      error = err;
      errorCount++;
      logger.warn(`Unable to get a ${contractName} contract instance will try again in 3 seconds`);
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
        if (message === 'challenge') callback(ws, args);
      });
      ws.on('error', () => {
        logger.debug('ERROR challenge WS');
      });
      ws.on('open', () => {
        logger.debug('OPEN challenge WS');
      });
      ws.on('close', (err) => {
        logger.debug(`CLOSE challenge WS: ${err}`);
      });
    }
  );
  logger.debug('Subscribed to Challenge WebSocket connection');
}

export async function subscribeToBlockAssembledWebSocketConnection(callback, ...args) {
  wss.on('connection', ws => {
      ws.on('message', message => {
        if (message === 'blocks') callback(ws, args);
      });
      ws.on('error', () => {
        logger.debug('ERROR block-assembly  WS');
      });
      ws.on('open', () => {
        logger.debug('OPEN block-assembly WS');
      });
      ws.on('close', (msg) => {
        logger.debug(`CLOSE block-assembly ${msg}`);
      });
    }
  );
  logger.debug('Subscribed to BlockAssembled WebSocket connection');
}

export async function subscribeToInstantWithDrawalWebSocketConnection(callback, ...args) {
  wss.on('connection', ws => {
      ws.on('message', message => {
        if (message === 'instant') callback(ws, args);
      });
      ws.on('error', () => {
        logger.debug('ERROR instant-withdraw');
      });
      ws.on('open', () => {
        logger.debug('OPEN instant-withdraw');
      });
      ws.on('close', (err) => {
        logger.debug(`CLOSE instant-withdraw ${err}`);
      });
    }
  );
  logger.debug('Subscribed to InstantWithDrawal WebSocket connection');
}
