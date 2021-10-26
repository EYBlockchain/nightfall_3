/* ignore unused exports */
import { txActionTypes } from './transactions.actions';

const initialState = {
  nTx: 0,
  nFailedTx: 0,
  txPool: [],
  txType: '',
  modalTx: false,
};

function txReducer(state = initialState, action) {
  switch (action.type) {
    case txActionTypes.TRANSACTION_SUCCESS:
      return {
        ...state,
        txPool: [
          ...state.txPool,
          {
            txType: action.payload.txType,
            txReceipt: action.payload.txReceipt,
            withdrawTransactionHash: action.payload.withdrawTransactionHash,
            nRetries: action.payload.nRetries,
          },
        ],
        nTx: state.nTx + 1,
        modalTx: false,
      };

    case txActionTypes.TRANSACTION_FAILED:
      return {
        ...state,
        nFailedTx: state.nFailedTx + 1,
        modalTx: false,
      };

    case txActionTypes.TRANSACTION_RETRY: {
      const txPool = [...state.txPool];
      const newTxPool = txPool.map(tx => {
        if (tx.withdrawTransactionHash === action.payload.withdrawTransactionHash) {
          const newTx = tx;
          newTx.nRetries++;
          return newTx;
        }
        return tx;
      });
      return {
        ...state,
        txPool: newTxPool,
        modalTx: false,
      };
    }

    case txActionTypes.TRANSACTION_NEW: {
      return {
        ...state,
        txType: action.payload.txType,
        modalTx: true,
      };
    }

    case txActionTypes.TRANSACTION_DISPATCHED: {
      return {
        ...state,
        txType: '',
      };
    }

    case txActionTypes.TRANSACTION_CANCELLED: {
      return {
        ...state,
        txType: '',
        modalTx: false,
      };
    }

    default:
      return state;
  }
}

export default txReducer;
