/**
Module to endable withdrawal of funds from the Shield contract to the user's
address.
*/
import config from 'config';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import { Transaction } from '../classes/index.mjs';
import { getTransactionByTransactionHash, getBlockByTransactionHash } from './database.mjs';

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

export async function finaliseWithdrawal({ transactionHash }) {
  const block = await getBlockByTransactionHash(transactionHash);
  const transactions = await Promise.all(
    block.transactionHashes.map(t => getTransactionByTransactionHash(t)),
  );
  const index = transactions.findIndex(f => f.transactionHash === transactionHash);

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

    let tokenType = 'ERC20';
    switch (transactions[index].tokenType) {
      case '1':
        tokenType = 'ERC20';
        break;
      case '2':
        tokenType = 'ERC1155';
        break;
      default:
        tokenType = 'ERC20';
        break;
    }

    // store the commitment on successful computation of the transaction
    return {
      rawTransaction,
      transaction: {
        ercAddress: `0x${BigInt(transactions[index].ercAddress).toString(16).padStart(40, '0')}`,
        recipientAddress: `0x${BigInt(transactions[index].recipientAddress)
          .toString(16)
          .padStart(40, '0')}`,
        tokenType,
        value: transactions[index].value,
      },
    };
  } catch (err) {
    throw new Error(err); // let the caller handle the error
  }
}
