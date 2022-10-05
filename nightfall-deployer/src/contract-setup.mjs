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
  await Promise.all(
    contractsState.map(async contract => {
      const setStateContract = contract.methods.setStateContract(stateAddress);
      if (!config.ETH_PRIVATE_KEY) {
        await setStateContract.send();
      } else {
        await Web3.submitRawTransaction(setStateContract.encodeABI(), contract.options.address);
      }
    }),
  );

  // transfer ownership
  await Promise.all(
    contractsOwnables.map(async contract => {
      const transferOwnership = contract.methods.transferOwnership(simpleMultiSigAddress);
      if (!config.ETH_PRIVATE_KEY) {
        await transferOwnership.send();
      } else {
        await Web3.submitRawTransaction(transferOwnership.encodeABI(), contract.options.address);
      }
    }),
  );
}

// export default setupContracts;
