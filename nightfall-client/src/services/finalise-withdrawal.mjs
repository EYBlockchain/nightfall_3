/**
Module to endable withdrawal of funds from the Shield contract to the user's
address.
*/
import { getContractInstance } from 'common-files/utils/contract.mjs';
import constants from 'common-files/constants/index.mjs';
import { buildBlockSolidityStruct } from 'common-files/utils/block-utils.mjs';
import { Transaction } from '../classes/index.mjs';
import { getTransactionByTransactionHash, getBlockByTransactionHash } from './database.mjs';

const { SHIELD_CONTRACT_NAME } = constants;

// eslint-disable-next-line import/prefer-default-export
export async function finaliseWithdrawal(transactionHash) {
  const block = await getBlockByTransactionHash(transactionHash);
  const transactions = await Promise.all(
    block.transactionHashes.map(t => getTransactionByTransactionHash(t)),
  );

  // block can contain multiple transactions not in our database
  const index = transactions.findIndex(f => transactionHash === f?.transactionHash ?? '0x0');

  const siblingPath = [transactions[index].transactionHashesRoot].concat(
    transactions[index].transactionHashSiblingPath.path.map(p => p.value).reverse(),
  );

  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  const rawTransaction = await shieldContractInstance.methods
    .finaliseWithdrawal(
      buildBlockSolidityStruct(block),
      Transaction.buildSolidityStruct(transactions[index]),
      index,
      siblingPath,
    )
    .encodeABI();

  // store the commitment on successful computation of the transaction
  return { rawTransaction };
}
