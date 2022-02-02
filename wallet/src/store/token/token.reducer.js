/* ignore unused exports */
import { tokenActionTypes } from './token.actions';
import * as Storage from '../../utils/lib/local-storage';

const initialState = {
  activeTokenRowId: '',
  activeTokenId: '',
  tokenPool: [],
  detailedErc1155: [],
};
/*
tokenAddress: DEFAULT_TOKEN_ADDRESS.ERC721,
tokenType: Nf3.Constants.TOKEN_TYPE.ERC721,
tokenId: DEFAULT_TOKEN_ID.ERC721,
tokenIdL2: [],
tokenName: 'TOKEN2',
tokenBalanceL1: '0',
tokenBalanceL2: '0',
tokenPendingDepositL2: '0',
tokenPendingSpentL2: '0',
tokenDetailsL1: [],
tokenDetailsL2: [],
decimals: 0,
*/
function tokenReducer(state = initialState, action) {
  switch (action.type) {
    case tokenActionTypes.TOKEN_ADD: {
      const oldTokenPool = state.tokenPool;
      const objIndex = oldTokenPool.findIndex(
        obj => obj.tokenAddress === action.payload.tokenInfo.tokenAddress,
      );
      // new token -> Add
      if (objIndex === -1) {
        const newTokenPool = [
          ...state.tokenPool,
          {
            tokenAddress: action.payload.tokenInfo.tokenAddress,
            tokenType: action.payload.tokenInfo.tokenType,
            tokenIdL1: action.payload.tokenInfo.tokenIdL1,
            tokenIdL2: action.payload.tokenInfo.tokenIdL2,
            tokenName: action.payload.tokenInfo.tokenName,
            tokenBalanceL1: action.payload.tokenInfo.tokenBalanceL1,
            tokenBalanceL2: action.payload.tokenInfo.tokenBalanceL2,
            tokenPendingDepositL2: action.payload.tokenInfo.tokenPendingDepositL2,
            tokenPendingSpentL2: action.payload.tokenInfo.tokenPendingSpentL2,
            tokenErc1155Details: action.payload.tokenInfo.tokenErc1155Details,
            tokenDecimals: action.payload.tokenInfo.decimals,
          },
        ];
        Storage.tokensSet(action.payload.compressedPkd, newTokenPool);
        return {
          ...state,
          tokenPool: newTokenPool,
        };
      }

      // existing token -> Update
      oldTokenPool[objIndex] = {
        tokenAddress: action.payload.tokenInfo.tokenAddress,
        tokenType: action.payload.tokenInfo.tokenType,
        tokenIdL1: action.payload.tokenInfo.tokenIdL1,
        tokenIdL2: action.payload.tokenInfo.tokenIdL2,
        tokenName: action.payload.tokenInfo.tokenName,
        tokenBalanceL1: action.payload.tokenInfo.tokenBalanceL1,
        tokenBalanceL2: action.payload.tokenInfo.tokenBalanceL2,
        tokenPendingDepositL2: action.payload.tokenInfo.tokenPendingDepositL2,
        tokenPendingSpentL2: action.payload.tokenInfo.tokenPendingSpentL2,
        tokenErc1155Details: action.payload.tokenInfo.tokenErc1155Details,
        tokenDecimals: action.payload.tokenInfo.decimals,
      };
      Storage.tokensSet(action.payload.compressedPkd, oldTokenPool);
      return {
        ...state,
        tokenPool: oldTokenPool,
      };
    }

    case tokenActionTypes.TOKEN_DELETE: {
      let newTokenPool;
      if (action.payload.activeTokenId === null) {
        newTokenPool = state.tokenPool.filter(
          token => token.tokenAddress !== action.payload.activeTokenRowId,
        );
      } else {
        newTokenPool = state.tokenPool.map(token => {
          const newToken = { ...token };
          if (token.tokenAddress !== action.payload.activeTokenRowId) {
            return newToken;
          }
          const updatedErc1155Details = newToken.tokenErc1155Details.filter(details => {
            if (details.tokenId !== action.payload.activeTokenId) {
              return true;
            }
            return false;
          });
          newToken.tokenErc1155Details = updatedErc1155Details;
          return newToken;
        });
      }
      Storage.tokensSet(action.payload.compressedPkd, newTokenPool);
      return {
        ...state,
        tokenPool: newTokenPool,
      };
    }

    case tokenActionTypes.TOKEN_SELECT:
      return {
        ...state,
        activeTokenRowId: action.payload.activeTokenRowId,
        activeTokenId: action.payload.activeTokenId,
        detailedErc1155: state.detailedErc1155.includes(action.payload.activeTokenRowId)
          ? [...state.detailedErc1155]
          : [...state.detailedErc1155, action.payload.activeTokenRowId],
      };

    case tokenActionTypes.TOKEN_UNSELECT:
      return {
        ...state,
        activeTokenRowId: '',
        activeTokenId: '',
        detailedErc1155: action.payload.removeFromDisplayedDetails
          ? state.detailedErc1155.filter(id => id !== state.activeTokenRowId)
          : state.detailedErc1155,
      };

    default:
      return state;
  }
}

export default tokenReducer;
