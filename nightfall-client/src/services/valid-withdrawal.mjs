/**
Module to endable withdrawal of funds from the Shield contract to the user's
address.
*/
import config from 'config';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import { Transaction } from '../classes/index.mjs';

const { SHIELD_CONTRACT_NAME } = config;

// TODO move classes to their own folder so this is not needed (it's already a
// static function in the Block class)
export function buildSolidityStruct(block) {
  const { proposer, root, leafCount, blockNumberL2, previousBlockHash } = block;
  return {
    proposer,
    root,
    leafCount: Number(leafCount),
    blockNumberL2: Number(blockNumberL2),
    previousBlockHash,
  };
}

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
