/**
Modules that acts as a 'liquidity provider'. This makes advance payments for
users who request an instant withdrawal. Note that it's a simple implementation
fand does not do any validity checks before it provides the advance. Do not use
this in production.
*/

import { Command } from 'commander/esm.mjs';
import clear from 'clear';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import Nf3 from '../lib/nf3.mjs';
import { setEnvironment, getCurrentEnvironment } from '../lib/environment.mjs';

const defaultKey = '0xfbc1ee1c7332e2e5a76a99956f50b3ba2639aff73d56477e877ef8390c41e0c6';
const defaultMnemonic = 'toy vivid real shove evolve kidney captain flock hungry evoke lawn plunge';
const program = new Command();
program.option('-k, --key', 'Ethereum signing key', defaultKey);
program.option('-h', '--help', 'Help');
if (program.opts().help) console.log('-k | --key input an Ethereum signing key to use');
const advanceWithdrawalEthereumSigningKey = program.opts().key || defaultKey;

const argv = yargs(hideBin(process.argv)).parse();
const { environment } = argv;
/**
Does the preliminary setup and starts listening on the websocket
@param {string} testEnvironment - Environment where propose is launched ('Testnet','Localhost','Docker')
*/
async function startProvider(testEnvironment) {
  clear();
  console.log('Starting Liquidity Provider...');
  if (typeof testEnvironment !== 'undefined') {
    setEnvironment(testEnvironment);
  } else {
    setEnvironment('Localhost');
  }
  const nf3Env = getCurrentEnvironment().currentEnvironment;
  const nf3 = new Nf3(advanceWithdrawalEthereumSigningKey, nf3Env);
  await nf3.init(defaultMnemonic);
  if (await nf3.healthcheck('optimist')) console.log('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  // set up a listener to service requests for an instant withdrawal
  const emitter = await nf3.getInstantWithdrawalRequestedEmitter();
  emitter.on('data', async (withdrawTransactionHash, paidBy, amount) => {
    await nf3.advanceInstantWithdrawal(withdrawTransactionHash);
    console.log(`Serviced instant-withdrawal request from ${paidBy}, with fee ${amount}`);
  });
  console.log('Listening for incoming events');
}

startProvider(environment);
