/**
Module that runs up as a challenger
*/
import config from 'config';
import logger from '../../common-files/utils/logger.mjs';
import app from './app.mjs';
import {
  nf3Init,
  nf3Healthcheck,
  nf3RegisterChallenger,
  nf3StartChallenger,
} from './nf3-wrapper.mjs';

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { signingKeys } = config.TEST_OPTIONS;
const { CHALLENGER_PORT } = process.env;

/**
Does the preliminary setup and starts listening on the websocket
*/
async function startChallenger() {
  logger.info('Starting Challenger...');
  // Mnemonic are only required for services connecting to a client that
  // can generate a compressed PKD.
  await nf3Init(signingKeys.challenger, environment, undefined, 'optimist');
  if (await nf3Healthcheck('optimist')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  logger.info('Attempting to register challenger');

  await nf3RegisterChallenger();
  if (CHALLENGER_PORT !== '') {
    logger.debug('Challenger healthcheck up');
    app.listen(CHALLENGER_PORT);
  }
  nf3StartChallenger();
  logger.info('Listening for incoming events');
}

startChallenger();
