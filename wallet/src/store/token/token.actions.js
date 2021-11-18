/* ignore unused exports */
export const tokenActionTypes = {
  TOKEN_ADD: 'TOKEN_ADD',
  TOKEN_DELETE: 'TOKEN_DELETE',
  TOKEN_SELECT: 'TOKEN_SELECT',
  TOKEN_UNSELECT: 'TOKEN_UNSELECT',
};

export function addToken(tokenAddress, tokenType, tokenId, l1Balance, l2Balance) {
  let newTokenAddress;
  if (!tokenAddress.startsWith('0x')) newTokenAddress = `0x${tokenAddress}`;
  else newTokenAddress = tokenAddress;
  return {
    type: tokenActionTypes.TOKEN_ADD,
    payload: { tokenAddress: newTokenAddress, tokenType, tokenId, l1Balance, l2Balance },
  };
}

export function deleteToken(activeTokenRowId) {
  return {
    type: tokenActionTypes.TOKEN_DELETE,
    payload: { activeTokenRowId },
  };
}

export function selectToken(activeTokenRowId) {
  return {
    type: tokenActionTypes.TOKEN_SELECT,
    payload: { activeTokenRowId },
  };
}

export function unselectToken() {
  return {
    type: tokenActionTypes.TOKEN_UNSELECT,
  };
}
