/**
 * This module discovers and manages optimistic peers for direct transfers
 */
import config from 'config';
import { web3 } from 'common-files/utils/web3.mjs';

const { STATE_CONTRACT_NAME } = config;

/* Retrieve N next proposers (eth address + URL). If N is not defined, retrieve all */
const getProposersUrl = async N => {
  const stateContractInstance = await web3.getContractInstance(STATE_CONTRACT_NAME);
  const currentProposer = await stateContractInstance.methods.currentProposer().call();
  const proposerList = { [currentProposer.thisAddress]: currentProposer.url };
  let nextProposer = await stateContractInstance.methods
    .proposers(currentProposer.nextAddress)
    .call();
  let proposerIdx = 0;
  while (currentProposer.thisAddress !== nextProposer.thisAddress && proposerIdx <= N) {
    proposerList[nextProposer.thisAddress] = nextProposer.url;

    // eslint-disable-next-line no-await-in-loop
    nextProposer = await stateContractInstance.methods.proposers(nextProposer.nextAddress).call();
    proposerIdx += 1;
  }
  return proposerList;
};

export default getProposersUrl;
