/* eslint-disable no-await-in-loop */

/**
 * Module to subscribe to blockchain events
 */
import { waitForContract } from 'common-files/utils/contract.mjs';
import constants from 'common-files/constants/index.mjs';
import logger from 'common-files/utils/logger.mjs';

const {
  STATE_CONTRACT_NAME,
  CHALLENGES_CONTRACT_NAME,
  SHIELD_CONTRACT_NAME,
  PROPOSERS_CONTRACT_NAME,
} = constants;

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
