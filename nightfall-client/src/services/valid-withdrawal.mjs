/**
Module to endable withdrawal of funds from the Shield contract to the user's
address.
*/
import config from 'config';
import { web3 } from 'common-files/utils/web3.mjs';

import { Transaction } from '../classes/index.mjs';
import { buildSolidityStruct } from './finalise-withdrawal.mjs';

const { SHIELD_CONTRACT_NAME } = config;

// eslint-disable-next-line import/prefer-default-export
export async function isValidWithdrawal({ block, transactions, index }) {
  const shieldContractInstance = await web3.getContractInstance(SHIELD_CONTRACT_NAME);
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
