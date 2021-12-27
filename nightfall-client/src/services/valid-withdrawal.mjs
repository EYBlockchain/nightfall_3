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
export async function isValidWithdrawal({ block, transactions, index }) {
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  try {
    const info = await shieldContractInstance.methods
      .isValidWithdrawal(
        buildSolidityStruct(block),
        block.blockNumberL2,
        transactions.map(t => Transaction.buildSolidityStruct(t)),
        index,
      )
      .call();
    return { valid: info[0], timestamp: info[1] };
  } catch (err) {
    return { valid: false };
  }
}
