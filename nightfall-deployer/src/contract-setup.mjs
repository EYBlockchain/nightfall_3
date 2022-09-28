/* eslint-disable no-await-in-loop */
/**
module to initialise the proposers, challenges and shield contracts with the
address of the contract that holds global state (State.sol)
*/

import config from 'config';
import Web3 from 'common-files/utils/web3.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import logger from 'common-files/utils/logger.mjs';

async function setupContracts() {
  const proposersContract = await getContractInstance('Proposers');
  const shieldContract = await getContractInstance('Shield');
  const challengesContract = await getContractInstance('Challenges');
  const stateContract = await getContractInstance('State');
  const stateAddress = stateContract.options.address;
  const simpleMultiSigAddress = (await getContractInstance('SimpleMultiSig')).options.address;
  logger.debug(`address of State contract is ${stateAddress}`);

  const contractsState = [proposersContract, shieldContract, challengesContract];
  const contractsOwnables = [proposersContract, shieldContract, challengesContract, stateContract];

  // set State
  // Need to call setStateContract 1 by 1 or transaction fails
  for (const contractState of contractsState) {
    const setStateContract = contractState.methods.setStateContract(stateAddress);
    if (!config.ETH_PRIVATE_KEY) {
      await setStateContract.send();
    } else {
      await Web3.submitRawTransaction(setStateContract.encodeABI(), contractState.options.address);
    }
  }

  // transfer ownership
  // Need to call transferOwnership 1 by 1 or transaction fails
  for (const contractOwnable of contractsOwnables) {
    const transferOwnership = contractOwnable.methods.transferOwnership(simpleMultiSigAddress);
    if (!config.ETH_PRIVATE_KEY) {
      await transferOwnership.send();
    } else {
      await Web3.submitRawTransaction(
        transferOwnership.encodeABI(),
        contractOwnable.options.address,
      );
    }
  }
}

export default setupContracts;
