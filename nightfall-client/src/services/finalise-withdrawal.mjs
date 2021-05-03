/**
Module to endable withdrawal of funds from the Shield contract to the user's
address.
*/
import config from 'config';
import { getContractInstance } from '../utils/contract.mjs';

const { SHIELD_CONTRACT_NAME } = config;

async function finaliseWithdrawal({ block, transaction }) {
  // first, find the position of the transaction in the block
  const index = block.transactionHashes.indexOf(transaction.transactionHash);
  // TODO we could check that the block is final here, but it's not required
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  try {
    const rawTransaction = await shieldContractInstance.methods
      .finaliseWithdrawal(block, transaction, index)
      .encodeABI();
    // store the commitment on successful computation of the transaction
    return { rawTransaction };
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}

export default finaliseWithdrawal;
