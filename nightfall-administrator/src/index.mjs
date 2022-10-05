/**
 * @module index.mjs
 * Code for performing administrator functions.  This code is designed to be run in an
 * ephemeral container, that performs the admin task.
 */
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import logger from '../../common-files/utils/logger.mjs';
import { initUI } from './ui/menu.mjs';
import start from './ui/get-info.mjs';
import { initMultiSig } from './services/helpers.mjs';

const argv = yargs(hideBin(process.argv)).parse();
const { environment } = argv;

async function main() {
  // compute multisig constants
  initMultiSig();
  // intialise the UI menu
  initUI();
  // start getting transaction information
  const signed = await start();
  console.log('******* Signed Transaction *******');
  console.log(signed);
  process.kill(process.pid, 'SIGTERM');
}

main(environment);
