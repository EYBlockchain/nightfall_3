/**
Module that runs up as a proposer
*/
import { Command } from 'commander/esm.mjs';
import clear from 'clear';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import Nf3 from '../lib/nf3.mjs';
import { setEnvironment, getCurrentEnvironment } from '../lib/environment.mjs';

const program = new Command();
const defaultKey = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d';
const defaultMnemonic = 'hurt labor ketchup seven scan swap dirt brown brush path goat together';
program.option('-k, --key', 'Ethereum signing key', defaultKey);
program.option('-h', '--help', 'Help');
if (program.opts().help) console.log('-k | --key input an Ethereum signing key to use');
const ethereumSigningKey = program.opts().key || defaultKey;

const argv = yargs(hideBin(process.argv)).parse();
const { environment } = argv;

/**
Does the preliminary setup and starts listening on the websocket
@param {string} testEnvironment - Environment where propose is launched ('Testnet','Localhost','Docker')
*/
async function startProposer(testEnvironment) {
  clear();
  console.log('Starting Proposer...');
  if (typeof testEnvironment !== 'undefined') {
    setEnvironment(testEnvironment);
  } else {
    setEnvironment('Localhost');
  }
  const nf3Env = getCurrentEnvironment().currentEnvironment;
  const nf3 = new Nf3(nf3Env.web3WsUrl, ethereumSigningKey, nf3Env);

  await nf3.init(defaultMnemonic);
  if (await nf3.healthcheck('optimist')) console.log('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  await nf3.registerProposer();
  console.log('Proposer registration complete');
  // TODO subscribe to layer 1 blocks and call change proposer
  nf3.startProposer();
  console.log('Listening for incoming events');
}

startProposer(environment);
