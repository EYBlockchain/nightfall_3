/* ignore unused exports */
export const tokenActionTypes = {
  TOKEN_ADD: 'TOKEN_ADD',
  TOKEN_DELETE: 'TOKEN_DELETE',
  TOKEN_SELECT: 'TOKEN_SELECT',
  TOKEN_UNSELECT: 'TOKEN_UNSELECT',
};

export function addToken(compressedPkd, tokenInfo) {
  return {
    type: tokenActionTypes.TOKEN_ADD,
    payload: {
      compressedPkd,
      tokenInfo,
    },
  };
}

export function deleteToken(compressedPkd, activeTokenRowId, activeTokenId) {
  return {
    type: tokenActionTypes.TOKEN_DELETE,
    payload: { compressedPkd, activeTokenRowId, activeTokenId },
  };
}

export function selectToken(activeTokenRowId, activeTokenId) {
  return {
    type: tokenActionTypes.TOKEN_SELECT,
    payload: { activeTokenRowId, activeTokenId },
  };
}

export function unselectToken(removeFromDisplayedDetails) {
  return {
    type: tokenActionTypes.TOKEN_UNSELECT,
    payload: { removeFromDisplayedDetails },
  };
}
