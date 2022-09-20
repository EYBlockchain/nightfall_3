import logger from 'common-files/utils/logger.mjs';
import { notifyInstantWithdrawalRequest } from '../services/instant-withdrawal.mjs';

async function instantWithdrawalRequestedEventHandler(data) {
  logger.debug({
    message: 'Instant withdrawal request', data: JSON.stringify(data.returnValues, null, 2)
  });

  const { withdrawTransactionHash, paidBy, amount } = data.returnValues;

  // TODO get the challenger to enact an advance of withdrawal automatically
  return notifyInstantWithdrawalRequest(withdrawTransactionHash, paidBy, amount);
}

export default instantWithdrawalRequestedEventHandler;
