/**
 * Module to subscribe to blockchain events
 */
import WebSocket from 'ws';
import config from 'config';
import { getContractInstance, getContractAddress } from '../utils/contract.mjs';
import logger from '../utils/logger.mjs';

const { SHIELD_CONTRACT_NAME, RETRIES, WEBSOCKET_PORT } = config;
const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });

/**
 * @deprecated: use the more general waitForContract function below
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

export async function subscribeToBlockProposedEvent(callback, ...args) {
  const emitter = (await waitForShield()).events.BlockProposed();
  emitter.on('data', event => callback(event, args));
  logger.debug('Subscribed to BlockProposed event');
  return emitter;
}

export async function subscribeToTransactionSubmitted(callback, ...args) {
  const emitter = (await waitForShield()).events.TransactionSubmitted();
  emitter.on('data', event => callback(event, args));
  logger.debug('Subscribed to TransactionSubmitted event');
  return emitter;
}

export async function subscribeToNewCurrentProposer(callback, ...args) {
  const emitter = (await waitForShield()).events.NewCurrentProposer();
  emitter.on('data', event => callback(event, args));
  logger.debug('Subscribed to NewCurrentProposer event');
  return emitter;
}

export async function subscribeToRejectedBlock(callback, ...args) {
  const emitter = (await waitForShield()).events.RejectedBlock();
  emitter.on('data', event => callback(event, args));
  logger.debug('Subscribed to RejectedBlock event');
  return emitter;
}

export async function subscribeToBlockDeletedEventHandler(callback, ...args) {
  const emitter = (await waitForShield()).events.BlockDeleted();
  emitter.on('data', event => callback(event, args));
  logger.debug('Subscribed to RejectedBlock event');
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

export async function subscribeToBlockAssembledWebSocketConnection(callback, ...args) {
  wss.on('connection', ws =>
    ws.on('message', message => {
      if (message === 'blocks') callback(ws, args);
    }),
  );
  logger.debug('Subscribed to WebSocket connection');
}
