/**
Module that runs up as a challenger
*/
import { Command } from 'commander/esm.mjs';
import clear from 'clear';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import Nf3 from '../lib/nf3.mjs';
import { setEnvironment, getCurrentEnvironment } from '../lib/environment.mjs';

const defaultKey = '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb';
const defaultMnemonic =
  'minimum swarm pelican target wish key sting elegant island panther weird planet';
const program = new Command();
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
async function startChallenger(testEnvironment) {
  clear();
  console.log('Starting Challenger...');
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
  await nf3.registerChallenger();
  console.log('Challenger registration complete');
  nf3.startChallenger();
  console.log('Listening for incoming events');
}

startChallenger(environment);
