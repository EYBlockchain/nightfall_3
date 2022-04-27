import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { web3 } from 'common-files/utils/web3.mjs';
import { Transaction } from '../classes/index.mjs';

let ws;
const { SHIELD_CONTRACT_NAME } = config;
export const advanceWithdrawal = async transaction => {
  const shieldContractInstance = await web3.getContractInstance(SHIELD_CONTRACT_NAME);
  try {
    const txDataToSign = await shieldContractInstance.methods
      .advanceWithdrawal(Transaction.buildSolidityStruct(transaction))
      .encodeABI();
    logger.info(`txDataToSign : ${txDataToSign}`);

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
