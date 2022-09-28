import Web3 from 'common-files/utils/web3.mjs';
import logger from 'common-files/utils/logger.mjs';
import circuits from './circuit-setup.mjs';

// TODO these can be paralleled
async function main() {
  logger.info('starting circuit setup');
  await circuits.waitForZokrates();
  await circuits.setupCircuits();
  logger.info('completed circuit setup');

  Web3.disconnect();
}

main().catch(e => logger.warn(e));
