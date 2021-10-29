/* ignore unused exports */
import { loginActionTypes } from './login.actions';

const initialState = {
  isWalletInitialized: false,
  nf3: {},
};

function loginReducer(state = initialState, action) {
  switch (action.type) {
    case loginActionTypes.LOGIN_FAILED:
      return {
        ...state,
        isWalletInitialized: false,
        nf3: {},
      };

    case loginActionTypes.LOGIN_SUCCESS:
      return {
        ...state,
        isWalletInitialized: true,
        nf3: action.payload.nf3,
      };

    default:
      return state;
  }
}

export default loginReducer;
