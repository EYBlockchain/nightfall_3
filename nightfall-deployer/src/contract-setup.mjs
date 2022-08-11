/**
module to initialise the proposers, challenges and shield contracts with the
address of the contract that holds global state (State.sol)
*/

import config from 'config';
import Web3 from 'common-files/utils/web3.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';

async function setupContracts() {
  const stateInstance = await waitForContract('State');
  console.log(`address of State contract is ${stateInstance.options.address}`);

  const simpleMultiSigAddress = (await waitForContract('SimpleMultiSig')).options.address;
  const shieldContractInstance = await waitForContract('Shield');
  const stateContractInstance = await waitForContract('State');
  const proposerContractInstance = await waitForContract('Proposers');
  const challengesContractInstance = await waitForContract('Challenges');

  logger.debug(
    `transfering ownership of contracts to simpleMultiSigAddress ${simpleMultiSigAddress}`,
  );

  // when deploying on infura
  // do serial registration to predict nonce
  // or, if we have the owner's private key, sign with that, rather than use an unlocked account
  if (config.ETH_PRIVATE_KEY) {
    try {
      await Web3.submitRawTransaction(
        proposerContractInstance.methods
          .setStateContract(stateInstance.options.address)
          .encodeABI(),
        proposerContractInstance.options.address,
      );
      await Web3.submitRawTransaction(
        shieldContractInstance.methods.setStateContract(stateInstance.options.address).encodeABI(),
        shieldContractInstance.options.address,
      );
      await Web3.submitRawTransaction(
        challengesContractInstance.methods
          .setStateContract(stateInstance.options.address)
          .encodeABI(),
        challengesContractInstance.options.address,
      );
    } catch (err) {
      if (err.message.includes('Transaction has been reverted by the EVM'))
        logger.warn(
          'Writing contract addresses to the State contract failed. This is probably because they are aready set. Did you already run deployer?',
        );
      else throw new Error(err);
    }

    // our last action as the deployer is to hand off our onlyOwner powers to the
    // multisig contract
    await Web3.submitRawTransaction(
      shieldContractInstance.methods.transferOwnership(simpleMultiSigAddress).encodeABI(),
      shieldContractInstance.options.address,
    );
    await Web3.submitRawTransaction(
      stateContractInstance.methods.transferOwnership(simpleMultiSigAddress).encodeABI(),
      stateContractInstance.options.address,
    );
    await Web3.submitRawTransaction(
      proposerContractInstance.methods.transferOwnership(simpleMultiSigAddress).encodeABI(),
      proposerContractInstance.options.address,
    );
    return Web3.submitRawTransaction(
      challengesContractInstance.methods.transferOwnership(simpleMultiSigAddress).encodeABI(),
      challengesContractInstance.options.address,
    );
  }

  try {
    // the following code runs the registrations in parallel
    await Promise.all([
      proposerContractInstance.methods.setStateContract(stateInstance.options.address).send(),
      shieldContractInstance.methods.setStateContract(stateInstance.options.address).send(),
      challengesContractInstance.methods.setStateContract(stateInstance.options.address).send(),
    ]);
  } catch (err) {
    if (err.message.includes('Transaction has been reverted by the EVM'))
      logger.warn(
        'Writing contract addresses to the State contract failed. This is probably because they are aready set. Did you already run deployer?',
      );
    else throw new Error(err);
  }

  // our last action as the deployer is to hand off our onlyOwner powers to the
  // multisig contract
  return Promise.all([
    shieldContractInstance.methods.transferOwnership(simpleMultiSigAddress).send(),
    stateContractInstance.methods.transferOwnership(simpleMultiSigAddress).send(),
    proposerContractInstance.methods.transferOwnership(simpleMultiSigAddress).send(),
    challengesContractInstance.methods.transferOwnership(simpleMultiSigAddress).send(),
  ]);
}

export default setupContracts;
