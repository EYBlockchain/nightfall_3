/**
module to initialise the proposers, challenges and shield contracts with the
address of the contract that holds global state (State.sol)
*/

import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { web3, getContractAddress } from 'common-files/utils/web3.mjs';

import { waitForContract } from 'common-files/utils/contract.mjs';

async function setupCircuits() {
  const stateInstance = await waitForContract('State');
  logger.debug(`address of State contract is ${stateInstance.options.address}`);

  // when deploying on infura
  // do serial registration to predict nonce
  // or, if we have the owner's private key, sign with that, rather than use an unlocked account
  if (config.ETH_PRIVATE_KEY) {
    await web3.submitRawTransaction(
      (await waitForContract('Proposers')).methods
        .setStateContract(stateInstance.options.address)
        .encodeABI(),
      (
        await getContractAddress('Proposers')
      ).address,
    );
    await web3.submitRawTransaction(
      (await waitForContract('Shield')).methods
        .setStateContract(stateInstance.options.address)
        .encodeABI(),
      (
        await getContractAddress('Shield')
      ).address,
    );
    return web3.submitRawTransaction(
      (await waitForContract('Challenges')).methods
        .setStateContract(stateInstance.options.address)
        .encodeABI(),
      (await getContractAddress('Challenges')).address,
    );
  }
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
