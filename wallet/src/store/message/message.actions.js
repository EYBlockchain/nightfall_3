/* ignore unused exports */
export const messageActionTypes = {
  MESSAGE_ERROR_NEW: 'MESSAGE_ERROR_NEW',
  MESSAGE_INFO_NEW: 'MESSAGE_INFO_NEW',
  MESSAGE_CLEAR: 'MESSAGE_CLEAR',
};

export function newError(errorMsg) {
  return {
    type: messageActionTypes.MESSAGE_ERROR_NEW,
    payload: { errorMsg },
  };
}

export function clearMsg() {
  return {
    type: messageActionTypes.MESSAGE_CLEAR,
  };
}

export function newInfo(infoMsg) {
  return {
    type: messageActionTypes.MESSAGE_INFO_NEW,
    payload: { infoMsg },
  };
}
