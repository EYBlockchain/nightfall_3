import { web3, web3Payments } from 'common-files/utils/web3.mjs';

import logger from 'common-files/utils/logger.mjs';
import circuits from './circuit-setup.mjs';
import setupContracts from './contract-setup.mjs';

// TODO these can be paralleled
async function main() {
  await circuits.waitForZokrates();
  await circuits.setupCircuits();
  try {
    await setupContracts();
  } catch (err) {
    if (err.message.includes('Transaction has been reverted by the EVM'))
      logger.warn(
        'Writing contract addresses to the State contract failed. This is probably because they are aready set. Did you already run deployer?',
      );
    else throw new Error(err);
  }
  web3.disconnect();
  web3Payments.disconnect();
}

main();
