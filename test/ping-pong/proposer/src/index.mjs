/**
Module that runs up as a proposer
*/
import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Nf3 from '../../../../cli/lib/nf3.mjs';
import { app, setOptimistUrl } from './app.mjs';

const { proposerEthereumSigningKey, optimistWsUrl, web3WsUrl, optimistBaseUrl } = config;
const { PROPOSER_PORT = '', PROPOSER_URL = '' } = process.env;

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
  await nf3.registerProposer(`${PROPOSER_URL}:${PROPOSER_PORT}`);
  logger.debug('Proposer registration complete');
  if (PROPOSER_PORT !== '') {
    setOptimistUrl(optimistBaseUrl);
    app.listen(PROPOSER_PORT);
    logger.debug(`Proposer API up at URL ${PROPOSER_URL} and port ${PROPOSER_PORT}`);
  }
  // TODO subscribe to layer 1 blocks and call change proposer
  nf3.startProposer();
  logger.info('Listening for incoming events');
}

startProposer();
