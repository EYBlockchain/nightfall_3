/* eslint-disable no-await-in-loop */

/**
 * Module to subscribe to blockchain events
 */
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import constants from 'common-files/constants/index.mjs';
import { getContractInstance, getContractAddress } from 'common-files/utils/contract.mjs';

const { RETRIES } = config;
const {
  PROPOSERS_CONTRACT_NAME,
  SHIELD_CONTRACT_NAME,
  CHALLENGES_CONTRACT_NAME,
  STATE_CONTRACT_NAME,
} = constants;

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
