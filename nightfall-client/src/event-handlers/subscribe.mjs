/* eslint-disable no-await-in-loop */

/**
 * Module to subscribe to blockchain events
 */
import { waitForContract } from '@polygon-nightfall/common-files/utils/contract.mjs';
import constants from '@polygon-nightfall/common-files/constants/index.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

const { STATE_CONTRACT_NAME } = constants;

// eslint-disable-next-line import/prefer-default-export
export async function startEventQueue(callback, ...args) {
  const emitter = (await waitForContract(STATE_CONTRACT_NAME)).events.allEvents();
  emitter.on('data', event => callback(event, args));
  emitter.on('changed', event => callback(event, args));
  logger.debug('Subscribed to layer 2 state events');
  return emitter;
}
