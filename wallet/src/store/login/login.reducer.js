import { loginActionTypes } from './login.actions';

const initialState = {
  isValidPrivateKey: false,
  wallet: {
    privateKey: '',
    ethereumAddress: '',
  },
  nf3: {},
};

function loginReducer(state = initialState, action) {
  switch (action.type) {
    case loginActionTypes.LOGIN_FAILED:
      return {
        ...state,
        isValidPrivateKey: false,
        wallet: action.payload.wallet,
        nf3: {},
      };

    case loginActionTypes.LOGIN_SUCCESS:
      return {
        ...state,
        isValidPrivateKey: true,
        wallet: action.payload.wallet,
        nf3: action.payload.nf3,
      };

    default:
      return state;
  }
}

export default loginReducer;
