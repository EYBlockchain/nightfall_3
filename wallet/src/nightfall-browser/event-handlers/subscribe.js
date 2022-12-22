/* eslint-disable no-await-in-loop */

// ignore unused exports startEventQueue
// ignore unused exports waitForContract

/**
 * Module to subscribe to blockchain events
 */
import { getContractInstance, getContractAddress } from '../../common-files/utils/contract';
import logger from '../../common-files/utils/logger';

const {
  STATE_CONTRACT_NAME,
  CHALLENGES_CONTRACT_NAME,
  PROPOSERS_CONTRACT_NAME,
  SHIELD_CONTRACT_NAME,
} = global.nightfallConstants;
const { RETRIES } = global.config;

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

// eslint-disable-next-line import/prefer-default-export
export async function startEventQueue(callback, ...args) {
  const contractNames = [
    STATE_CONTRACT_NAME,
    SHIELD_CONTRACT_NAME,
    CHALLENGES_CONTRACT_NAME,
    PROPOSERS_CONTRACT_NAME,
  ];
  const contracts = await Promise.all(contractNames.map(c => waitForContract(c)));
  const emitters = contracts.map(e => {
    const emitterC = e.events.allEvents();
    emitterC.on('changed', event => callback(event, args));
    emitterC.on('data', event => callback(event, args));
    return emitterC;
  });
  logger.debug('Subscribed to layer 2 contract events');
  return emitters;
}
