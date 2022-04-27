/**
Module to endable withdrawal of funds from the Shield contract to the user's
address.
*/
import config from 'config';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import { Transaction } from '../classes/index.mjs';
import { buildSolidityStruct } from './finalise-withdrawal.mjs';

const { SHIELD_CONTRACT_NAME } = config;

// eslint-disable-next-line import/prefer-default-export
export async function isValidWithdrawal({ block, transaction, index, siblingPath }) {
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  try {
    const valid = await shieldContractInstance.methods
      .isValidWithdrawal(
        buildSolidityStruct(block),
        Transaction.buildSolidityStruct(transaction),
        index,
        siblingPath,
      )
      .call();
    return valid;
  } catch (err) {
    return false;
  }
}
