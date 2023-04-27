/**
 * This module enables setting instant withdrawals fees
 */

import { getContractInstance } from 'common-files/utils/contract.mjs';
import constants from 'common-files/constants/index.mjs';
import { buildBlockSolidityStruct } from 'common-files/utils/block-utils.mjs';
import { Transaction } from '../classes/index.mjs';
import { getTransactionByTransactionHash, getBlockByTransactionHash } from './database.mjs';

const { SHIELD_CONTRACT_NAME } = constants;

const setInstantWithdrawl = async ({ transactionHash }) => {
  const block = await getBlockByTransactionHash(transactionHash);
  const transactions = await Promise.all(
    block.transactionHashes.map(t => getTransactionByTransactionHash(t)),
  );
  const index = transactions.findIndex(f => f.transactionHash === transactionHash);

  const siblingPath = [transactions[index].transactionHashesRoot].concat(
    transactions[index].transactionHashSiblingPath.path.map(p => p.value).reverse(),
  );

  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  try {
    const rawTransaction = await shieldContractInstance.methods
      .setAdvanceWithdrawalFee(
        buildBlockSolidityStruct(block),
        Transaction.buildSolidityStruct(transactions[index]),
        index,
        siblingPath,
      )
      .encodeABI();
    return { rawTransaction };
  } catch (error) {
    throw new Error(error);
  }
};
export default setInstantWithdrawl;
