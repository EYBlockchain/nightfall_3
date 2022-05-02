/**
Module to endable withdrawal of funds from the Shield contract to the user's
address.
*/
import config from 'config';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import { Transaction } from '../classes/index.mjs';
// eslint-disable-next-line import/no-cycle
import { buildSolidityStruct } from './finalise-withdrawal.mjs';

const { SHIELD_CONTRACT_NAME, PROPOSE_BLOCK_TYPES } = config;

// eslint-disable-next-line import/prefer-default-export
export async function isValidWithdrawal({ block, transaction, index, siblingPath }) {
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  try {
    console.log;
    const valid = await shieldContractInstance.methods
      .isValidWithdrawal(
        buildSolidityStruct(block),
        block.transactionsHash,
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
