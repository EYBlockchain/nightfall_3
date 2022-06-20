/**
@module index.mjs
Code for performing administrator functions.  This code is designed to be run in an
ephemeral container, that performs the admin task.
*/
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { initUI } from './ui/menu.mjs';
import startLoop from './ui/loop.mjs';

const argv = yargs(hideBin(process.argv)).parse();
const { environment } = argv;

async function main() {
  // intialise the UI menu
  initUI();
  // start the interactive control loop
  await startLoop();
  // nf3.close();
  // TODO work out why nf3 isn't closing cleanly
  process.exit(0);
}

main(environment);
