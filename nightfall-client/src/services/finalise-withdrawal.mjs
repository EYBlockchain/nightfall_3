/**
Module to endable withdrawal of funds from the Shield contract to the user's
address.
*/
import { getContractInstance } from 'common-files/utils/contract.mjs';
import constants from 'common-files/constants/index.mjs';
import { Transaction } from '../classes/index.mjs';
import { getTransactionByTransactionHash, getBlockByTransactionHash } from './database.mjs';

const { SHIELD_CONTRACT_NAME } = constants;

// TODO move classes to their own folder so this is not needed (it's already a
// static function in the Block class)
export function buildSolidityStruct(block) {
  const {
    proposer,
    root,
    leafCount,
    blockNumberL2,
    previousBlockHash,
    frontierHash,
    transactionHashesRoot,
  } = block;
  return {
    proposer,
    root,
    leafCount: Number(leafCount),
    blockNumberL2: Number(blockNumberL2),
    previousBlockHash,
    frontierHash,
    transactionHashesRoot,
  };
}

export async function finaliseWithdrawal(transactionHash) {
  const block = await getBlockByTransactionHash(transactionHash);
  const transactions = await Promise.all(
    block.transactionHashes.map(t => getTransactionByTransactionHash(t)),
  );
  const index = transactions.findIndex(f => f.transactionHash === transactionHash);

  const siblingPath = [transactions[index].transactionHashesRoot].concat(
    transactions[index].transactionHashSiblingPath.path.map(p => p.value).reverse(),
  );

  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  const rawTransaction = await shieldContractInstance.methods
    .finaliseWithdrawal(
      buildSolidityStruct(block),
      Transaction.buildSolidityStruct(transactions[index]),
      index,
      siblingPath,
    )
    .encodeABI();

  // store the commitment on successful computation of the transaction
  return { rawTransaction };
}
