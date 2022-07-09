/**
module to initialise the proposers, challenges and shield contracts with the
address of the contract that holds global state (State.sol)
*/

import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import Web3 from 'common-files/utils/web3.mjs';
import { waitForContract, getContractAddress } from 'common-files/utils/contract.mjs';

async function setupCircuits() {
  const stateInstance = await waitForContract('State');
  logger.debug(`address of State contract is ${stateInstance.options.address}`);

  // do serial registration to predict nonce
  // or, if we have the owner's private key, sign with that, rather than use an unlocked account
  if (config.ETH_PRIVATE_KEY) {
    await Web3.submitRawTransaction(
      (await waitForContract('Proposers')).methods
        .setStateContract(stateInstance.options.address)
        .encodeABI(),
      await getContractAddress('Proposers'),
    );
    await Web3.submitRawTransaction(
      (await waitForContract('Shield')).methods
        .setStateContract(stateInstance.options.address)
        .encodeABI(),
      await getContractAddress('Shield'),
    );
    return Web3.submitRawTransaction(
      (await waitForContract('Challenges')).methods
        .setStateContract(stateInstance.options.address)
        .encodeABI(),
      await getContractAddress('Challenges'),
    );
  }
  // the following code runs the registrations in parallel
  await Promise.all([
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
  // our last action as the deployer is to hand off our onlyOwner powers to the
  // multisig contract
  const simpleMultiSigAddress = (await waitForContract('SimpleMultiSig')).options.address;
  const shieldContractInstance = await waitForContract('Shield');
  const stateContractInstance = await waitForContract('State');
  const proposerContractInstance = await waitForContract('Proposers');
  const challengesContractInstance = await waitForContract('Challenges');
  return Promise.all([
    shieldContractInstance.methods.transferOwnership(simpleMultiSigAddress).send(),
    stateContractInstance.methods.transferOwnership(simpleMultiSigAddress).send(),
    proposerContractInstance.methods.transferOwnership(simpleMultiSigAddress).send(),
    challengesContractInstance.methods.transferOwnership(simpleMultiSigAddress).send(),
  ]);
}

export default setupCircuits;
