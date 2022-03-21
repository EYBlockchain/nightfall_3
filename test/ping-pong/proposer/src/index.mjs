/**
Module that runs up as a proposer
*/
import config from 'config';
import logger from '../../../../common-files/utils/logger.mjs';
import app from './app.mjs';
import { Nf3Instance } from './nf3-wrapper.mjs';

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { signingKeys } = config.TEST_OPTIONS;
const { PROPOSER_PORT } = process.env;

/**
Does the preliminary setup and starts listening on the websocket
*/
async function startProposer() {
  logger.info('Starting Proposer...');
  const nf3 = Nf3Instance(signingKeys.proposer1, environment);
  // Mnemonic are only required for services connecting to a client that
  // can generate a compressed PKD.
  await nf3.init(undefined, 'optimist');
  if (await nf3.healthcheck('optimist')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  logger.info('Attempting to register proposer');

  await nf3.registerProposer(environment.proposerBaseUrl);
  if (PROPOSER_PORT !== '') {
    logger.debug('Proposer healthcheck up');
    app.listen(PROPOSER_PORT);
  }
  // TODO subscribe to layer 1 blocks and call change proposer
  nf3.startProposer();
  logger.info('Listening for incoming events');
}

startProposer();
