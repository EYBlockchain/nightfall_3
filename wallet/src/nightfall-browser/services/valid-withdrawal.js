// ignore unused exports isValidWithdrawal

/**
Module to endable withdrawal of funds from the Shield contract to the user's
address.
*/
import { getContractInstance } from '../../common-files/utils/contract';
import { Transaction } from '../classes/index';
import { getBlockByTransactionHash, getTransactionByTransactionHash } from './database';

const { SHIELD_CONTRACT_NAME } = global.config;

// TODO move classes to their own folder so this is not needed (it's already a
// static function in the Block class)
function buildSolidityStruct(block) {
  const { proposer, root, leafCount, blockNumberL2, previousBlockHash } = block;
  return {
    proposer,
    root,
    leafCount: Number(leafCount),
    blockNumberL2: Number(blockNumberL2),
    previousBlockHash,
  };
}

// eslint-disable-next-line import/prefer-default-export
export async function isValidWithdrawal(transactionHash, shieldContractAddress) {
  const block = await getBlockByTransactionHash(transactionHash);
  const transactions = await Promise.all(
    block.transactionHashes.map(t => getTransactionByTransactionHash(t)),
  );
  const index = transactions.findIndex(f => f.transactionHash === transactionHash);

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
        buildSolidityStruct(block),
        block.transactionsHash,
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
