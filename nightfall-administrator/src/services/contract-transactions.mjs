/* eslint-disable import/prefer-default-export */
import config from 'config';
import { waitForContract } from '../../../common-files/utils/contract.mjs';
import { sendTransaction } from './helpers.mjs';

const { RESTRICTIONS } = config;
/**
This function sets the restriction data that the Shield contract is currently using
*/
export async function setTokenRestrictions(
  tokenName,
  depositRestriction,
  withdrawRestriction,
  signingKey,
) {
  const shieldContractInstance = await waitForContract('Shield');
  for (const token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
    if (token.name === tokenName) {
      const tx = shieldContractInstance.methods
        .setRestriction(token.address, depositRestriction, withdrawRestriction)
        .encodeABI();
      return sendTransaction(tx, signingKey, shieldContractInstance.options.address);
    }
  }
  return false;
}
