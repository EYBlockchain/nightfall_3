/**
Module that runs up as a proposer
*/
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Nf3 from '../../../../cli/lib/nf3.mjs';

const { proposerEthereumSigningKey, optimistWsUrl, web3WsUrl, optimistBaseUrl } = config;

/**
Does the preliminary setup and starts listening on the websocket
*/
async function startProposer() {
  logger.info('Starting Proposer...');
  const nf3 = new Nf3(proposerEthereumSigningKey, {
    web3WsUrl,
    optimistApiUrl: optimistBaseUrl,
    optimistWsUrl,
  });
  await nf3.init(undefined, 'optimist');
  if (await nf3.healthcheck('optimist')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  await nf3.registerProposer();
  logger.debug('Proposer registration complete');
  // TODO subscribe to layer 1 blocks and call change proposer
  nf3.startProposer();
  logger.info('Listening for incoming events');
}

startProposer();
