/**
Modules that acts as a 'liquidity provider'. This makes advance payments for
users who request an instant withdrawal. Note that it's a simple implementation
fand does not do any validity checks before it provides the advance. Do not use
this in production.
*/

import { Command } from 'commander/esm.mjs';
import clear from 'clear';
import Nf3 from '../lib/nf3.mjs';

const defaultKey = '0xfbc1ee1c7332e2e5a76a99956f50b3ba2639aff73d56477e877ef8390c41e0c6';
const program = new Command();
program.option('-k, --key', 'Ethereum signing key', defaultKey);
program.option('-h', '--help', 'Help');
if (program.opts().help) console.log('-k | --key input an Ethereum signing key to use');
const advanceWithdrawalEthereumSigningKey = program.opts().key || defaultKey;

/**
Does the preliminary setup and starts listening on the websocket
*/
async function startProvider() {
  clear();
  console.log('Starting Liquidity Provider...');
  const nf3 = new Nf3(
    'http://localhost:8080',
    'http://localhost:8081',
    'ws://localhost:8082',
    'ws://localhost:8546',
    advanceWithdrawalEthereumSigningKey,
  );
  await nf3.init();
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

startProvider();
