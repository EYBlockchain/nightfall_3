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

export async function finaliseWithdrawal({ block, transactions, index }) {
  // first, find the position of the transaction in the block
  // TODO we could check that the block is final here, but it's not required
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  try {
    const rawTransaction = await shieldContractInstance.methods
      .finaliseWithdrawal(
        buildSolidityStruct(block),
        block.blockNumberL2,
        transactions.map(t => Transaction.buildSolidityStruct(t)),
        index,
      )
      .encodeABI();
    // store the commitment on successful computation of the transaction
    return { rawTransaction };
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}
