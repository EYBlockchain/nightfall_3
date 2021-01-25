/**
 * Module to subscribe to blockchain events
 */

import config from 'config';
import { getContractInstance, getContractAddress } from './contract.mjs';
import logger from './logger.mjs';

const { SHIELD_CONTRACT_NAME, RETRIES } = config;

/**
 * Function that tries to get a Shield contract instance and, if it fails, will
 * retry after 3 seconds.  After RETRIES attempts, it will give up and throw.
 * This is useful in case nightfall-client comes up before the Shield contract
 * is fully deployed.
 */
async function waitForShield() {
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

export async function subscribeToBlockProposedEvents(callback) {
  const emitter = (await waitForShield()).events.BlockProposed();
  emitter.on('data', event => callback(event));
  return emitter;
}

export async function subscribeToTransactionSubmitted(callback) {
  const emitter = (await waitForShield()).events.TransactionSubmitted();
  emitter.on('data', event => callback(event));
  return emitter;
}
