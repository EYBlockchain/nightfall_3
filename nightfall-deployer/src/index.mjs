import Web3 from 'common-files/utils/web3.mjs';
import circuits from './circuit-setup.mjs';
import setupContracts from './contract-setup.mjs';

// TODO these can be paralleled
async function main() {
  await circuits.waitForZokrates();
  await circuits.setupCircuits();
  await setupContracts();
  Web3.disconnect();
}

main();
