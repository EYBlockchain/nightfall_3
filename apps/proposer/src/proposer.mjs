/* eslint-disable import/no-unresolved */
/**
Module that runs up as a proposer
*/
import config from 'config';
import logger from '../common-files/utils/logger.mjs';

const { MINIMUM_STAKE } = config.TEST_OPTIONS;
/**
Does the preliminary setup and starts listening on the websocket
*/
export default async function startProposer(nf3, proposerBaseUrl) {
  logger.info('Starting Proposer...');
  // Mnemonic are only required for services connecting to a client that
  // can generate a compressed PKD.

  await nf3.init(undefined, 'optimist');
  if (await nf3.healthcheck('optimist')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  logger.info('Attempting to register proposer');

  await nf3.registerProposer(proposerBaseUrl, MINIMUM_STAKE);
  logger.debug('Proposer healthcheck up');

  // TODO subscribe to layer 1 blocks and call change proposer
  await nf3.startProposer();
  logger.info('Listening for incoming events');
}
