import config from 'config';
import logger from 'common-files/utils/logger.mjs';
import { getContractInstance } from 'common-files/utils/contract.mjs';
import { Transaction } from '../classes/index.mjs';

let ws;
const { SHIELD_CONTRACT_NAME } = config;
export const advanceWithdrawal = async transaction => {
  const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
  try {
    const txDataToSign = await shieldContractInstance.methods
      .advanceWithdrawal(Transaction.buildSolidityStruct(transaction))
      .encodeABI();
    logger.info(`txDataToSign : ${txDataToSign}`);

    let tokenType = 'ERC20';
    switch (transaction.tokenType) {
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

    return {
      txDataToSign,
      transaction: {
        ercAddress: `0x${BigInt(transaction.ercAddress).toString(16).padStart(40, '0')}`,
        recipientAddress: `0x${BigInt(transaction.recipientAddress)
          .toString(16)
          .padStart(40, '0')}`,
        tokenType,
        value: transaction.value,
      },
    };
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
