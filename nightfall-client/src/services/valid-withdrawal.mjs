/**
Module to endable withdrawal of funds from the Shield contract to the user's
address.
*/
import { getContractInstance } from 'common-files/utils/contract.mjs';
import constants from 'common-files/constants/index.mjs';
import { buildBlockSolidityStruct } from 'common-files/utils/block-utils.mjs';
import logger from 'common-files/utils/logger.mjs';
import { Transaction } from '../classes/index.mjs';
// eslint-disable-next-line import/no-cycle

const { SHIELD_CONTRACT_NAME } = constants;

// eslint-disable-next-line import/prefer-default-export
export async function isValidWithdrawal({ block, transaction, index, siblingPath }) {
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  try {
    const valid = await shieldContractInstance.methods
      .isValidWithdrawal(
        buildBlockSolidityStruct(block),
        Transaction.buildSolidityStruct(transaction),
        index,
        siblingPath,
      )
      .call();
    return valid;
  } catch (err) {
    logger.error(err);
    return false;
  }
}
