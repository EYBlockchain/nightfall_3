/**
Module that runs up as a proposer
*/
import config from 'config';
import logger from '../../../../common-files/utils/logger.mjs';
import app from './app.mjs';
import { Nf3Instance } from './nf3-wrapper.mjs';

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { mnemonics, signingKeys } = config.TEST_OPTIONS;
const { PROPOSER_PORT } = process.env;

/**
Does the preliminary setup and starts listening on the websocket
*/
async function startProposer() {
  logger.info('Starting Proposer...');
  const nf3 = new Nf3Instance(signingKeys.proposer1, environment);
  await nf3.init(mnemonics.proposer);
  if (await nf3.healthcheck('optimist')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  logger.info('Attempting to register proposer');
  // let's see if the proposer has been registered before
  const { proposers } = await nf3.getProposers();
  // if not, let's register them
  if (proposers.length === 0) {
    await nf3.registerProposer(environment.proposerBaseUrl);
    logger.info('Proposer registration complete');
  } else if (!proposers.map(p => p.thisAddress).includes(nf3.ethereumAddress)) {
    await nf3.registerProposer(environment.proposerBaseUrl);
    logger.info('Proposer registration complete');
  } else logger.warn('Proposer appears to be registerd already');
  app.listen(PROPOSER_PORT);
  logger.debug(`Proposer API up at URL ${environment.proposerBaseUrl}`);
  // TODO subscribe to layer 1 blocks and call change proposer
  nf3.startProposer();
  logger.info('Listening for incoming events');
}

startProposer();
