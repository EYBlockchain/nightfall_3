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

export async function startEventQueue(callback, arg) {
  const emitterState = (await waitForContract(STATE_CONTRACT_NAME)).events.allEvents();
  const emitterShield = (await waitForContract(SHIELD_CONTRACT_NAME)).events.allEvents();
  const emitterChallenges = (await waitForContract(CHALLENGES_CONTRACT_NAME)).events.allEvents();
  emitterState.on('changed', event => callback(event, arg));
  emitterShield.on('changed', event => callback(event, arg));
  emitterChallenges.on('changed', event => callback(event, arg));
  emitterState.on('data', event => callback(event, arg));
  emitterShield.on('data', event => callback(event, arg));
  emitterChallenges.on('data', event => callback(event, arg));
  logger.debug('Subscribed to layer 2 state events');
  return { emitterState, emitterShield, emitterChallenges };
}

export async function subscribeToNewCurrentProposer(callback, ...args) {
  const emitterProp = (await waitForContract(PROPOSERS_CONTRACT_NAME)).events.NewCurrentProposer();
  const emitterState = (await waitForContract(STATE_CONTRACT_NAME)).events.NewCurrentProposer();
  emitterProp.on('data', event => callback(event, args));
  emitterState.on('data', event => callback(event, args));
  logger.debug('Subscribed to NewCurrentProposer event');
  return { emitterProp, emitterState };
}

export async function subscribeToRemovedNewCurrentProposer(callback, ...args) {
  const emitterProp = (await waitForContract(PROPOSERS_CONTRACT_NAME)).events.NewCurrentProposer();
  const emitterState = (await waitForContract(STATE_CONTRACT_NAME)).events.NewCurrentProposer();
  emitterProp.on('changed', event => callback(event, args));
  emitterState.on('changed', event => callback(event, args));
  logger.debug('Subscribed to NewCurrentProposer event removal');
  return { emitterProp, emitterState };
}

export async function subscribeToChallengeWebSocketConnection(callback, ...args) {
  wss.on('connection', ws =>
    ws.on('message', message => {
      if (message === 'challenge') callback(ws, args);
    }),
  );
  logger.debug('Subscribed to WebSocket connection');
}

export async function subscribeToBlockAssembledWebSocketConnection(callback, ...args) {
  wss.on('connection', ws =>
    ws.on('message', message => {
      if (message === 'blocks') callback(ws, args);
    }),
  );
  logger.debug('Subscribed to WebSocket connection');
}
