/**
Module that runs up as a proposer
*/
import config from 'config';
import logger from '../../../common-files/utils/logger.mjs';

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { PROPOSER_PORT } = config;

/**
Does the preliminary setup and starts listening on the websocket
*/
export default async function startProposer(nf3) {
  logger.info('Starting Proposer...');
  // Mnemonic are only required for services connecting to a client that
  // can generate a compressed PKD.

  await nf3.init(undefined, 'optimist');
  if (await nf3.healthcheck('optimist')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  logger.info('Attempting to register proposer');

  await nf3.registerProposer(environment.proposerBaseUrl);
  if (!PROPOSER_PORT) throw new Error('Please specify a proposer port');
  logger.debug('Proposer healthcheck up');

  // TODO subscribe to layer 1 blocks and call change proposer
  await nf3.startProposer();
  logger.info('Listening for incoming events');
}
