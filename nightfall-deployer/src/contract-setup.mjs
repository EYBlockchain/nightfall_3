/**
module to initialise the proposers, challenges and shield contracts with the
address of the contract that holds global state (State.sol)
*/

import logger from './utils/logger.mjs';
import { waitForContract } from './utils/contract.mjs';
// import Web3 from './utils/web3.mjs';

async function setupCircuits() {
  const stateInstance = await waitForContract('State');
  logger.debug(`address of State contract is ${stateInstance.options.address}`);
  // the following code runs the registrations in parallel
  return Promise.all([
    (await waitForContract('Proposers')).methods
      .setStateContract(stateInstance.options.address)
      .send(),
    (await waitForContract('Shield')).methods
      .setStateContract(stateInstance.options.address)
      .send(),
    (await waitForContract('Challenges')).methods
      .setStateContract(stateInstance.options.address)
      .send(),
  ]);
}

export default setupCircuits;
