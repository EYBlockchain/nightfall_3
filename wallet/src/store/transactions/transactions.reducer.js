/* ignore unused exports */
import { txActionTypes } from './transactions.actions';

const initialState = {
  nTx: 0,
  nFailedTx: 0,
  txType: '',
  modalTx: false,
  withdrawInfo: [],
};

function txReducer(state = initialState, action) {
  switch (action.type) {
    case txActionTypes.TRANSACTION_SUCCESS:
      return {
        ...state,
        nTx: state.nTx + 1,
        modalTx: false,
      };

    case txActionTypes.TRANSACTION_FAILED:
      return {
        ...state,
        nFailedTx: state.nFailedTx + 1,
        modalTx: false,
      };

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

    case txActionTypes.TRANSACTION_WITHDRAW_UPDATE: {
      return {
        ...state,
        withdrawInfo: action.payload.withdrawInfo.filter(el => el.withdrawalInfo.valid === true),
      };
    }

    default:
      return state;
  }
}

export default txReducer;
