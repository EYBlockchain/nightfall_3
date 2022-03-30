/**
Module that runs up as a proposer
*/
import config from 'config';
import logger from '../../../../common-files/utils/logger.mjs';
import app from './app.mjs';
import {
  nf3Init,
  nf3Healthcheck,
  nf3RegisterProposer,
  nf3StartProposer,
  nf3DeregisterProposer,
  nf3Close,
} from './nf3-wrapper.mjs';

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { signingKeys } = config.TEST_OPTIONS;
const { PROPOSER_PORT, GENESIS_BLOCKS } = process.env;

/**
Does the preliminary setup and starts listening on the websocket
*/
async function startProposer() {
  logger.info('Starting Proposer...');
  let server;
  let currentBlocks = 0;
  // Mnemonic are only required for services connecting to a client that
  // can generate a compressed PKD.
  await nf3Init(signingKeys.proposer1, environment, undefined, 'optimist');
  if (await nf3Healthcheck('optimist')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  logger.info('Attempting to register proposer');

  await nf3RegisterProposer(environment.proposerBaseUrl);
  if (PROPOSER_PORT !== '') {
    logger.debug('Proposer healthcheck up');
    server = app.listen(PROPOSER_PORT);
  }
  // Proposer listening for incoming events
  const newGasBlockEmitter = nf3StartProposer();
  if (GENESIS_BLOCKS) {
    logger.debug(`Waiting for ${GENESIS_BLOCKS} blocks to end the test`);
    newGasBlockEmitter.on('gascost', async gasUsed => {
      logger.debug(`Block proposal gas cost was ${gasUsed}`);
      currentBlocks++;
      if (currentBlocks === Number(GENESIS_BLOCKS)) {
        logger.debug('De-registering proposer...');
        await nf3DeregisterProposer();
        await nf3Close();
        server.close(); // close proposer server
      }
    });
  }
  logger.info('Listening for incoming events');
}

startProposer();
