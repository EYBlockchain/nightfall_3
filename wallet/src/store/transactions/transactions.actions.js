/* ignore unused exports */
export const txActionTypes = {
  TRANSACTION_SUCCESS: 'TRANSACTION_SUCCESS',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  TRANSACTION_RETRY: 'TRANSACTION_RETRY',
  TRANSACTION_NEW: 'TRANSACTION_NEW',
  TRANSACTION_CANCELLED: 'TRANSACTION_CANCELLED',
  TRANSACTION_DISPATCHED: 'TRANSACTION_DISPATCHED',
};

export function txNew(txType) {
  return {
    type: txActionTypes.TRANSACTION_NEW,
    payload: {
      txType,
      modalTx: true,
    },
  };
}

export function txDispatch() {
  return {
    type: txActionTypes.TRANSACTION_DISPATCHED,
  };
}
export function txFailed() {
  return {
    type: txActionTypes.TRANSACTION_FAILED,
  };
}

export function txCancel() {
  return {
    type: txActionTypes.TRANSACTION_CANCELLED,
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
