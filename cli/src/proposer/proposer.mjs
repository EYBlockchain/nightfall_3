/**
Module that runs up as a proposer
*/
import { Command } from 'commander/esm.mjs';
import clear from 'clear';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { nf3Init, nf3Healthcheck, nf3RegisterProposer, nf3StartProposer } from './nf3-wrapper.mjs';
import app from './app.mjs';

import { setEnvironment, getCurrentEnvironment } from '../../lib/environment.mjs';

const program = new Command();
const defaultKey = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d';
const defaultMnemonic = 'hurt labor ketchup seven scan swap dirt brown brush path goat together';
program.option('-k, --key', 'Ethereum signing key', defaultKey);
program.option('-h', '--help', 'Help');
if (program.opts().help) console.log('-k | --key input an Ethereum signing key to use');
const ethereumSigningKey = program.opts().key || defaultKey;

const argv = yargs(hideBin(process.argv)).parse();
const {
  environment = 'Localhost',
  proposerPort = 8100, // Default port
  // Default Proposer URL. Client Docker needs to connect
  // to host, and this is the configured gateway IP in docker compose
  proposerBaseUrl = 'http://172.16.238.1',
} = argv;

/**
Does the preliminary setup and starts listening on the websocket
@param {string} testEnvironment - Environment where propose is launched ('Testnet','Localhost','Docker')
*/
async function startProposer(testEnvironment) {
  clear();
  console.log('Starting Proposer...');
  setEnvironment(testEnvironment);
  const nf3Env = getCurrentEnvironment().currentEnvironment;
  await nf3Init(
    ethereumSigningKey,
    {
      web3WsUrl: nf3Env.web3WsUrl,
      optimistApiUrl: nf3Env.optimistApiUrl,
      optimistWsUrl: nf3Env.optimistWsUrl,
      clientApiUrl: nf3Env.clientApiUrl,
    },
    defaultMnemonic,
  );

  if (await nf3Healthcheck('optimist')) console.log('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  await nf3RegisterProposer(`${proposerBaseUrl}:${proposerPort}`);
  console.log('Proposer registration complete');
  // Configure Optimist URL so that proposer listener
  // knows where to route queries
  app.listen(Number(proposerPort));
  console.log(`Proposer's API running at ${proposerBaseUrl}:${proposerPort}`);
  // TODO subscribe to layer 1 blocks and call change proposer
  nf3StartProposer();
  console.log('Listening for incoming events');
}

startProposer(environment);
