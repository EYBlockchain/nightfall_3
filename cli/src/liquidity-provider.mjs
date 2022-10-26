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
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../lib/nf3.mjs';
import { APPROVE_AMOUNT, TOKEN_TYPE } from '../lib/constants.mjs';
import { setEnvironment, getCurrentEnvironment } from '../lib/environment.mjs';
import { approve } from '../lib/tokens.mjs';

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
  logger.info('Starting Liquidity Provider...');
  if (typeof testEnvironment !== 'undefined') {
    setEnvironment(testEnvironment);
  } else {
    setEnvironment('Localhost');
  }
  const nf3Env = getCurrentEnvironment().currentEnvironment;
  const nf3 = new Nf3(advanceWithdrawalEthereumSigningKey, nf3Env);
  await nf3.init(defaultMnemonic);
  if (await nf3.healthcheck('optimist')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  const erc20Address = await nf3.getContractAddress('ERC20Mock');

  // Aprove ERC20 contract
  await approve(
    erc20Address,
    nf3.ethereumAddress,
    nf3.shieldContractAddress,
    TOKEN_TYPE.ERC20,
    APPROVE_AMOUNT,
    nf3.web3,
  );

  // set up a listener to service requests for an instant withdrawal
  const emitter = await nf3.getInstantWithdrawalRequestedEmitter();
  emitter.on('data', async (withdrawTransactionHash, paidBy, amount) => {
    await nf3.advanceInstantWithdrawal(withdrawTransactionHash);
    logger.info(`Serviced instant-withdrawal request from ${paidBy}, with fee ${amount}`);
  });
  logger.info('Listening for incoming events');
}

startProvider(environment);
