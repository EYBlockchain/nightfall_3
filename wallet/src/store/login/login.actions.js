/* ignore unused exports */
export const loginActionTypes = {
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
};

export function loadWallet(nf3) {
  return {
    type: loginActionTypes.LOGIN_SUCCESS,
    payload: { nf3 },
  };
}

export function deleteWallet() {
  return {
    type: loginActionTypes.LOGIN_FAILED,
  };
}
