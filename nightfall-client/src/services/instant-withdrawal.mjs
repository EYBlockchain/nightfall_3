/**
 * This module enables setting instant withdrawals fees
 */

import config from 'config';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import { Transaction } from '../classes/index.mjs';
import { buildSolidityStruct } from './finalise-withdrawal.mjs';

const { SHIELD_CONTRACT_NAME } = config;

const setInstantWithdrawl = async ({ block, transactions, index }) => {
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  try {
    const rawTransaction = await shieldContractInstance.methods
      .setAdvanceWithdrawalFee(
        buildSolidityStruct(block),
        block.blockNumberL2,
        transactions.map(t => Transaction.buildSolidityStruct(t)),
        index,
      )
      .encodeABI();
    return { rawTransaction };
  } catch (error) {
    throw new Error(error);
  }
};
export default setInstantWithdrawl;
