/* ignore unused exports */
import { errorActionTypes } from './error.actions';

const initialState = {
  errorMsg: '',
};

function errorReducer(state = initialState, action) {
  switch (action.type) {
    case errorActionTypes.ERROR_NEW:
      return {
        ...state,
        errorMsg: action.payload.errorMsg,
      };

    case errorActionTypes.ERROR_CLEAR:
      return {
        ...state,
        errorMsg: '',
      };

    default:
      return state;
  }
}

export default errorReducer;
