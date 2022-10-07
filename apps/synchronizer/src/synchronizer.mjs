/**
Module that runs up as a synchronizer
*/
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

/**
Does the preliminary setup and starts listening on the websocket
*/
export default async function startSynchronizer(nf3) {
  logger.info('Starting Synchronizer...');
  // Mnemonic are only required for services connecting to a client that
  // can generate a compressed PKD.

  await nf3.init(undefined, 'optimist');
  if (await nf3.healthcheck('optimist')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  logger.info('Listening for incoming events');
}
