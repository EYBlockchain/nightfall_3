export const loginActionTypes = {
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
};

export function loadWallet(wallet, nf3) {
  return {
    type: loginActionTypes.LOGIN_SUCCESS,
    payload: { wallet, nf3 },
  };
}

export function deleteWallet() {
  const wallet = {
    privateKey: '',
    ethereumAddres: '',
  };
  return {
    type: loginActionTypes.LOGIN_FAILED,
    payload: { wallet },
  };
}
