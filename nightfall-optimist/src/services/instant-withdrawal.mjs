import logger from 'common-files/utils/logger.mjs';
import constants from 'common-files/constants/index.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import { Transaction } from '../classes/index.mjs';
import { getBlockByTransactionHash, getTransactionByTransactionHash } from './database.mjs';
import Block from '../classes/block.mjs';

let ws;
const { SHIELD_CONTRACT_NAME } = constants;
export const advanceWithdrawal = async transactionHash => {
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
    const txDataToSign = await shieldContractInstance.methods
      .advanceWithdrawal(
        Block.buildSolidityStruct(block),
        Transaction.buildSolidityStruct(transactions[index]),
        index,
        siblingPath,
      )
      .encodeABI();

    logger.info({ msg: 'Transaction data to sign', txDataToSign });

    return { txDataToSign };
  } catch (error) {
    throw new Error(error);
  }
};

export function setInstantWithdrawalWebSocketConnection(_ws) {
  ws = _ws;
}

export async function notifyInstantWithdrawalRequest(withdrawTransactionHash, paidBy, amount) {
  if (!ws) {
    logger.warn('No one is listening for instant withdrawal requests');
    return;
  }
  ws.send(JSON.stringify({ type: 'instant', withdrawTransactionHash, paidBy, amount }));
}
