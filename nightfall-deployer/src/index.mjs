import Web3 from '@polygon-nightfall/common-files/utils/web3.mjs';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { promisify } from 'util';
import child from 'child_process';
import circuits from './circuit-setup.mjs';
import setupContracts from './contract-setup.mjs';

const execPromise = promisify(child.exec);

const { SKIP_DEPLOYMENT, UPGRADE = '', ETH_NETWORK, PARALLEL_SETUP = 'true' } = process.env;

async function execShellCommand(cmd) {
  const shellPromise = execPromise(cmd);
  const shell = shellPromise.child;
  shell.stdout.on('data', function (data) {
    logger.debug(`shell stdout: ${data}`);
  });
  shell.stderr.on('data', function (data) {
    logger.warn(`shell stderr: ${data}`);
  });
  shell.on('close', function (code) {
    logger.info(`shell closing code: ${code}`);
  });
  const { stdout, stderr } = await shellPromise;
  if (stdout) {
    logger.info('shell stdout:', stdout);
  }
  if (stderr) {
    logger.warn('shell stderr:', stderr);
  }
}

async function deployContracts() {
  if (SKIP_DEPLOYMENT === 'true') {
    logger.info(`skipping contract deployment`);
    return;
  }
  console.time('deployContracts - Execution Time');
  await execShellCommand(`npx truffle compile --all`);
  if (!UPGRADE) {
    await execShellCommand(`npx truffle migrate --to 3 --network=${ETH_NETWORK}`);
  } else {
    await execShellCommand(`npx truffle migrate -f 4 --network=${ETH_NETWORK} --skip-dry-run`);
  }
  console.timeEnd('deployContracts - Execution Time');
}

async function safeSetupContracts() {
  try {
    await setupContracts();
  } catch (err) {
    if (err.message.includes('Transaction has been reverted by the EVM'))
      logger.warn(
        'Writing contract addresses to the State contract failed. This is probably because they are already set. Did you already run deployer?',
      );
    else throw new Error(err);
  }
}

async function setupCircuits() {
  await circuits.waitForWorker();
  console.time('setupCircuits - Execution Time');
  await circuits.setupCircuits();
  console.timeEnd('setupCircuits - Execution Time');
}

async function bootstrap() {
  // eslint-disable-next-line no-unused-vars
  return Promise.all([deployContracts(), setupCircuits()]).then(_values => safeSetupContracts());
}

async function main() {
  logger.info(`deployer starting bootstrap ${PARALLEL_SETUP}`);
  if (PARALLEL_SETUP === 'true') {
    await bootstrap();
  } else {
    await circuits.waitForWorker();
    await circuits.setupCircuits();
    await safeSetupContracts();
  }
  try {
    Web3.disconnect();
  } catch (err) {
    logger.warn(`Attempt to disconnect web3 failed because ${err}`);
    process.exit(0);
  }
  logger.info(`deployer bootstrap done`);
}

main();
