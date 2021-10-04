/**
Module that runs up as a combined proposer and challenger
*/
import { Command } from 'commander/esm.mjs';
import clear from 'clear';
import Nf3 from '../lib/nf3.mjs';

const program = new Command();
const defaultKey = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
program.option('-k, --key', 'Ethereum signing key', defaultKey);
program.option('-h', '--help', 'Help');
if (program.opts().help) console.log('-k | --key input an Ethereum signing key to use');
const ethereumSigningKey = program.opts().key || defaultKey;

/**
Does the preliminary setup and starts listening on the websocket
*/
async function startProposer() {
  clear();
  console.log('Starting Proposer...');
  const nf3 = new Nf3(
    'http://localhost:8080',
    'http://localhost:8081',
    'ws://localhost:8082',
    'ws://localhost:8546',
    ethereumSigningKey,
  );
  await nf3.init();
  if (await nf3.healthcheck('optimist')) console.log('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  await nf3.registerProposer();
  console.log('Proposer registration complete');
  // TODO subscribe to layer 1 blocks and call change proposer
  nf3.startProposer();
  console.log('Listening for incoming events');
}

startProposer();
