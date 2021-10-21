import { TX_TYPES } from "../../constants";

/* ignore unused exports */
export const txActionTypes = {
  TRANSACTION_SUCCESS: 'TRANSACTION_SUCCESS',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  TRANSACTION_RETRY: 'TRANSACTION_RETRY',
};

export function txFailed() {
  return {
    type: txActionTypes.TRANSACTION_FAILED,
  };
}

export function txSuccess(txType, txReceipt, withdrawTransactionHash, nRetries) {
  return {
    type: txActionTypes.TRANSACTION_SUCCESS,
    payload: { txType, txReceipt, withdrawTransactionHash, nRetries },
  };
}

export function txRetry(withdrawTransactionHash) {
  return {
    type: txActionTypes.TRANSACTION_RETRY,
    payload: { withdrawTransactionHash },
  };
}
