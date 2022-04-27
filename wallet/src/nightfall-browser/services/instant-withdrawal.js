/* ignore unused exports */

/**
 * This module enables setting instant withdrawals fees
 */
import { getContractInstance } from '../../common-files/utils/contract';
import { Transaction } from '../classes/index';
import { buildSolidityStruct } from './finalise-withdrawal';
import { getTransactionByTransactionHash, getBlockByTransactionHash } from './database';
import { getTransactionHashSiblingInfo } from './commitment-storage';

const { SHIELD_CONTRACT_NAME } = global.config;

const setInstantWithdrawl = async (transactionHash, shieldContractAddress) => {
  const block = await getBlockByTransactionHash(transactionHash);
  const transactions = await Promise.all(
    block.transactionHashes.map(t => getTransactionByTransactionHash(t)),
  );
  const index = transactions.findIndex(f => f.transactionHash === transactionHash);

  const { transactionHashSiblingPath, transactionHashesRoot } = await getTransactionHashSiblingInfo(
    transactions[index].transactionHash,
  );
  const siblingPath = [transactionHashesRoot].concat(
    transactionHashSiblingPath.path.map(p => p.value).reverse(),
  );

  const shieldContractInstance = await getContractInstance(
    SHIELD_CONTRACT_NAME,
    shieldContractAddress,
  );
  try {
    const rawTransaction = await shieldContractInstance.methods
      .setAdvanceWithdrawalFee(
        buildSolidityStruct(block),
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
