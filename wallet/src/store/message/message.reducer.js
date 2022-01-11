/* ignore unused exports */
import { messageActionTypes } from './message.actions';

const initialState = {
  nf3Msg: '',
  nf3MsgType: '',
};

function messageReducer(state = initialState, action) {
  switch (action.type) {
    case messageActionTypes.MESSAGE_ERROR_NEW:
      return {
        ...state,
        nf3Msg: action.payload.errorMsg,
        nf3MsgType: 'error',
      };

    case messageActionTypes.MESSAGE_CLEAR:
      return {
        ...state,
        nf3Msg: '',
        nf3MsgType: '',
      };

    case messageActionTypes.MESSAGE_INFO_NEW:
      return {
        ...state,
        nf3Msg: action.payload.infoMsg,
        nf3MsgType: 'info',
      };

    default:
      return state;
  }
}

export default messageReducer;
