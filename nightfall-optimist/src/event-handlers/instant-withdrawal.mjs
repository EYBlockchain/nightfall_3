import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { notifyInstantWithdrawalRequest } from '../services/instant-withdrawal.mjs';

async function instantWithdrawalRequestedEventHandler(data) {
  logger.debug({
    msg: 'Instant withdrawal request',
    data: data.returnValues,
  });

  const { withdrawTransactionHash, paidBy, amount } = data.returnValues;

  // TODO get the challenger to enact an advance of withdrawal automatically
  return notifyInstantWithdrawalRequest(withdrawTransactionHash, paidBy, amount);
}

export default instantWithdrawalRequestedEventHandler;
