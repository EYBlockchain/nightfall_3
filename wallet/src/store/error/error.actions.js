/* ignore unused exports */
export const errorActionTypes = {
  ERROR_NEW: 'ERROR_NEW',
  ERROR_CLEAR: 'ERROR_CLEAR',
};

export function newError(errorMsg) {
  return {
    type: errorActionTypes.ERROR_NEW,
    payload: { errorMsg },
  };
}

export function clearError() {
  return {
    type: errorActionTypes.ERROR_CLEAR,
  };
}
