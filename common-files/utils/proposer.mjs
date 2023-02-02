/**
Module containing functions relating to proposers and their registration
*/
import { waitForContract } from './contract.mjs';
import constants from '../constants/index.mjs';

const { STATE_CONTRACT_NAME } = constants;

async function getProposers() {
  const stateContractInstance = await waitForContract(STATE_CONTRACT_NAME);
  // proposers is an on-chain mapping so to get proposers we need to key to start iterating
  // the safest to start with is the currentProposer
  const currentProposer = await stateContractInstance.methods.currentProposer().call();
  const proposers = [];
  let thisPtr = currentProposer.thisAddress;
  // Loop through the circular list until we run back into the currentProposer.
  do {
    // eslint-disable-next-line no-await-in-loop
    const prop = await stateContractInstance.methods.proposers(thisPtr).call();
    proposers.push(prop);
    thisPtr = prop.nextAddress;
  } while (thisPtr !== currentProposer.thisAddress);
  return proposers;
}

export default getProposers;
