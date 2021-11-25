/**
Module that runs up as a proposer
*/
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Nf3 from './nf3.mjs';

const { proposerEthereumSigningKey, optimistWsUrl, web3WsUrl, clientBaseUrl, optimistBaseUrl } =
  config;

/**
Does the preliminary setup and starts listening on the websocket
*/
async function startProposer() {
  logger.info('Starting Proposer...');
  const nf3 = new Nf3(
    clientBaseUrl,
    optimistBaseUrl,
    optimistWsUrl,
    web3WsUrl,
    proposerEthereumSigningKey,
  );
  await nf3.init();
  if ((await nf3.healthcheck('optimist')) && (await nf3.healthcheck('client')))
    logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  await nf3.registerProposer();
  logger.debug('Proposer registration complete');
  // TODO subscribe to layer 1 blocks and call change proposer
  nf3.startProposer();
  logger.info('Listening for incoming events');
}

startProposer();
