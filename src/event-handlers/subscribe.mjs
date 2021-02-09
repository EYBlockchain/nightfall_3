/**
 * Module to subscribe to blockchain events
 */

import config from 'config';
import WebSocket from 'ws';
import { getContractInstance, getContractAddress } from '../utils/contract.mjs';
import logger from '../utils/logger.mjs';

const { SHIELD_CONTRACT_NAME, RETRIES, WEBSOCKET_PORT } = config;

const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });

/**
 * Function that tries to get a Shield contract instance and, if it fails, will
 * retry after 3 seconds.  After RETRIES attempts, it will give up and throw.
 * This is useful in case nightfall-optimist comes up before the Shield contract
 * is fully deployed.
 */
export async function waitForShield() {
  let errorCount = 0;
  let error;
  let instance;
  while (errorCount < RETRIES) {
    try {
      error = undefined;
      const address = await getContractAddress(SHIELD_CONTRACT_NAME);
      logger.debug(`Shield contract address is ${address}`);
      if (address === undefined) throw new Error('Shield address was undefined');
      instance = getContractInstance(SHIELD_CONTRACT_NAME, address);
      return instance;
    } catch (err) {
      error = err;
      errorCount++;
      logger.warn('Unable to get a Shield contract instance will try again in 3 seconds');
      await new Promise(resolve => setTimeout(() => resolve(), 3000));
    }
  }
  if (error) throw error;
  return instance;
}

export async function subscribeToBlockProposedEvent(callback) {
  const emitter = (await waitForShield()).events.BlockProposed();
  emitter.on('data', event => callback(event));
  logger.debug('Subscribed to BlockProposed event');
  return emitter;
}

export async function transactionSubmitted(callback) {
  const emitter = (await waitForShield()).events.TransactionSubmitted();
  emitter.on('data', event => callback(event));
  logger.debug('Subscribed to TransactionSubmitted event');
  return emitter;
}

export async function subscribeToNewCurrentProposer(callback) {
  const emitter = (await waitForShield()).events.NewCurrentProposer();
  emitter.on('data', event => callback(event));
  logger.debug('Subscribed to NewCurrentProposer event');
  return emitter;
}

export async function subscribeToChallengeWebSocketConnection(callback, ...args) {
  wss.on('connection', ws =>
    ws.on('message', message => {
      if (message === 'challenge') callback(ws, args);
    }),
  );
  logger.debug('Subscribed to WebSocket connection');
}
