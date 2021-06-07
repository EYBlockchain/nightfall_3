/**
module to initialise the proposers, challenges and shield contracts with the
address of the contract that holds global state (State.sol)
*/

import logger from './utils/logger.mjs';
import { waitForContract } from './utils/contract.mjs';
// import Web3 from './utils/web3.mjs';

async function setupCircuits() {
  const proposersInstance = await waitForContract('Proposers');
  const shieldInstance = await waitForContract('Shield');
  const challengesInstance = await waitForContract('Challenges');
  const stateInstance = await waitForContract('State');
  logger.debug(`address of State contract is ${stateInstance.options.address}`);
  await proposersInstance.methods.setStateContract(stateInstance.options.address).send();
  await challengesInstance.methods.setStateContract(stateInstance.options.address).send();
  await shieldInstance.methods.setStateContract(stateInstance.options.address).send();
  logger.debug('State.sol successfully registered with client contracts');
}

export default setupCircuits;
