/**
Module that runs up as a proposer
*/
import Nf3 from './nf3.mjs';
import config from './config.mjs';

const { ethereumSigningKey, defaultMnemonic, optimistWsUrl, web3WsUrl } = config;

/**
Does the preliminary setup and starts listening on the websocket
*/
async function startProposer() {
  console.log('Starting Proposer...');
  const nf3 = new Nf3(null, null, optimistWsUrl, web3WsUrl, ethereumSigningKey);
  await nf3.init(defaultMnemonic);
  if (await nf3.healthcheck('optimist')) console.log('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  await nf3.registerProposer();
  console.log('Proposer registration complete');
  // TODO subscribe to layer 1 blocks and call change proposer
  nf3.startProposer();
  console.log('Listening for incoming events');
}

startProposer();
