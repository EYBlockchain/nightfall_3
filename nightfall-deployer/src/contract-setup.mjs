/**
module to initialise the proposers, challenges and shield contracts with the
address of the contract that holds global state (State.sol)
*/

import config from 'config';
import Web3 from 'common-files/utils/web3.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import logger from 'common-files/utils/logger.mjs';

async function setupContracts() {
  const stateInstanceAddress = (await getContractInstance('State')).options.address;
  const simpleMultiSigAddress = (await getContractInstance('SimpleMultiSig')).options.address;
  logger.debug(`address of State contract is ${stateInstanceAddress}`);

  const contracts = await Promise.all([
    await getContractInstance('Proposers'),
    await getContractInstance('Shield'),
    await getContractInstance('Challenges'),
  ]);

  await Promise.all(
    contracts.map(async contract => {
      const setStateContract = contract.methods.setStateContract(stateInstanceAddress);
      const transferOwnership = contract.methods.transferOwnership(simpleMultiSigAddress);

      if (!config.ETH_PRIVATE_KEY) {
        setStateContract.send();
        transferOwnership.send();
      } else {
        await Web3.submitRawTransaction(setStateContract.encodeABI(), contract.options.address);

        await Web3.submitRawTransaction(transferOwnership.encodeABI(), contract.options.address);
      }
    }),
  );
}

export default setupContracts;
