/**
 * This module discovers and manages optimistic peers for direct transfers
 */
import config from 'config';
import { getContractInstance } from 'common-files/utils/contract.mjs';

const { STATE_CONTRACT_NAME, PROPOSERS_CONTRACT_NAME } = config;

/* Retrieve N next proposers (eth address + URL). If N is not defined, retrieve all */
const getProposers = async N => {
  const stateContractInstance = await getContractInstance(STATE_CONTRACT_NAME);
  const proposersContractInstance = await getContractInstance(PROPOSERS_CONTRACT_NAME);
  const currentProposer = await stateContractInstance.methods.currentProposer().call();
  const currentProposerUrl = await proposersContractInstance.methods
    .proposerUrl(currentProposer.thisAddress)
    .call();
  const proposerList = { [currentProposer.thisAddress]: currentProposerUrl };
  let nextProposer = await stateContractInstance.methods
    .proposers(currentProposer.nextAddress)
    .call();
  let nextProposerUrl = await proposersContractInstance.methods
    .proposerUrl(currentProposer.nextAddress)
    .call();
  let proposerIdx = 0;
  while (currentProposer.thisAddress !== nextProposer.thisAddress && proposerIdx <= N) {
    proposerList[nextProposer.thisAddress] = nextProposerUrl;

    // eslint-disable-next-line no-await-in-loop
    nextProposer = await stateContractInstance.methods.proposers(nextProposer.nextAddress).call();
    // eslint-disable-next-line no-await-in-loop
    nextProposerUrl = await proposersContractInstance.methods
      .proposerUrl(nextProposer.nextAddress)
      .call();
    proposerIdx += 1;
  }
  return proposerList;
};

export default getProposers;

