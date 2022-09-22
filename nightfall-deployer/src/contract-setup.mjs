/**
module to initialise the proposers, challenges and shield contracts with the
address of the contract that holds global state (State.sol)
*/

import config from 'config';
import Web3 from 'common-files/utils/web3.mjs';
import { waitForContract } from 'common-files/utils/contract.mjs';
import logger from 'common-files/utils/logger.mjs';

async function setupContracts() {
  const web3 = Web3.connection();

  const stateInstance = await waitForContract('State');
  logger.debug(`address of State contract is ${stateInstance.options.address}`);

  const proposersInstance = await waitForContract('Proposers');
  const shieldInstance = await waitForContract('Shield');
  const challengesInstance = await waitForContract('Challenges');

  const simpleMultiSigAddress = (await waitForContract('SimpleMultiSig')).options.address;

  const contracts = {
    proposersInstance,
    shieldInstance,
    challengesInstance,
  };

  for await (const contractName of Object.keys(contracts)) {
    const setStateContract = contracts[contractName].methods.setStateContract(
      stateInstance.options.address,
    );

    const transferOwnership =
      contracts[contractName].methods.transferOwnership(simpleMultiSigAddress);

    if (!config.ETH_PRIVATE_KEY) {
      setStateContract.send();
      transferOwnership.send();
    } else {
      await Web3.submitRawTransaction(
        setStateContract.encodeABI(),
        contracts[contractName].options.address,
      );

      await Web3.submitRawTransaction(
        transferOwnership.encodeABI(),
        contracts[contractName].options.address,
      );
    }
  }
}

export default setupContracts;
