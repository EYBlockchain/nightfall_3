/* eslint-disable no-await-in-loop */

/**
 * Module to subscribe to blockchain events
 */
import config from 'config';
import { getContractInstance, getContractAddress } from '../utils/contract.mjs';
import logger from '../utils/logger.mjs';

const { STATE_CONTRACT_NAME, RETRIES } = config;

/**
 * Function that tries to get a (named) contract instance and, if it fails, will
 * retry after 3 seconds.  After RETRIES attempts, it will give up and throw.
 * This is useful in case nightfall-client comes up before the contract
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
  const emitter = (await waitForContract(STATE_CONTRACT_NAME)).events.BlockProposed();
  emitter.on('data', event => callback(event, args));
  logger.debug('Subscribed to BlockProposed event');
  return emitter;
}

export async function subscribeToRollbackEventHandler(callback, ...args) {
  const emitter = (await waitForContract(STATE_CONTRACT_NAME)).events.Rollback();
  emitter.on('data', event => callback(event, args));
  logger.debug('Subscribed to Rollback event');
  return emitter;
}
