/* eslint-disable import/prefer-default-export */
import config from 'config';
import { waitForContract } from '../../../common-files/utils/contract.mjs';

const { RESTRICTIONS } = config;
/**
This function returns the restriction data that the Shield contract is currently using
*/
export async function getTokenRestrictions(tokenName) {
  const shieldContractInstance = await waitForContract('Shield');
  let depositRestrictions;
  let withdrawRestrictions;
  for (const token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
    if (token.name === tokenName) {
      depositRestrictions = shieldContractInstance.methods.getRestriction(token.address, 0).call();
      withdrawRestrictions = shieldContractInstance.methods.getRestriction(token.address, 1).call();
    }
  }
  return Promise.all([depositRestrictions, withdrawRestrictions]);
}
/**
 This function returns the group ID of the manager if the address given is a whitelist manager
 */
export async function isWhitelistManager(address) {
  const shieldContractInstance = await waitForContract('Shield');
  return shieldContractInstance.methods.isWhitelistManager(address).call();
}
