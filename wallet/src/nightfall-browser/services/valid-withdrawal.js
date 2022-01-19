// ignore unused exports isValidWithdrawal

/**
Module to endable withdrawal of funds from the Shield contract to the user's
address.
*/
import { getContractInstance } from '../../common-files/utils/contract';
import { Transaction } from '../classes/index';
import { buildSolidityStruct } from './finalise-withdrawal';

const { SHIELD_CONTRACT_NAME } = global.config;

// eslint-disable-next-line import/prefer-default-export
export async function isValidWithdrawal({ block, transactions, index }) {
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  try {
    const valid = await shieldContractInstance.methods
      .isValidWithdrawal(
        buildSolidityStruct(block),
        block.blockNumberL2,
        transactions.map(t => Transaction.buildSolidityStruct(t)),
        index,
      )
      .call();
    return valid;
  } catch (err) {
    return false;
  }
}
