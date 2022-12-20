// ignore unused exports isValidWithdrawal

/**
Module to endable withdrawal of funds from the Shield contract to the user's
address.
*/
import { buildBlockSolidityStruct } from '../../common-files/utils/block-utils.js';
import { getContractInstance } from '../../common-files/utils/contract';
import { Transaction } from '../classes/index';
import { getBlockByTransactionHash, getTransactionByTransactionHash } from './database';

const { SHIELD_CONTRACT_NAME } = global.nightfallConstants;

// eslint-disable-next-line import/prefer-default-export
export async function isValidWithdrawal(transactionHash, shieldContractAddress) {
  const block = await getBlockByTransactionHash(transactionHash);
  const transactions = await Promise.all(
    block.transactionHashes.map(t => getTransactionByTransactionHash(t)),
  );
  const index = transactions.findIndex(f => f.transactionHash === transactionHash);
  console.log("XXXXXX", transactions[index])
  const siblingPath = [transactions[index].transactionHashesRoot].concat(
    transactions[index].transactionHashSiblingPath.path.map(p => p.value).reverse(),
  );

  const shieldContractInstance = await getContractInstance(
    SHIELD_CONTRACT_NAME,
    shieldContractAddress,
  );
  try {
    const valid = await shieldContractInstance.methods
      .isValidWithdrawal(
        buildBlockSolidityStruct(block),
        Transaction.buildSolidityStruct(transactions[index]),
        index,
        siblingPath,
      )
      .call();
    return valid;
  } catch (err) {
    return false;
  }
}
