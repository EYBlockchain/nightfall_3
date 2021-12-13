/* ignore unused exports */
import { tokenActionTypes } from './token.actions';
import * as Storage from '../../utils/lib/local-storage';

const initialState = {
  activeTokenRowId: '',
  tokenPool: [],
};

function tokenReducer(state = initialState, action) {
  switch (action.type) {
    case tokenActionTypes.TOKEN_ADD: {
      const oldTokenPool = state.tokenPool;
      const objIndex = oldTokenPool.findIndex(
        obj => obj.tokenAddress === action.payload.tokenAddress,
      );
      // new token -> Add
      if (objIndex === -1) {
        const newTokenPool = [
          ...state.tokenPool,
          {
            tokenAddress: action.payload.tokenAddress,
            tokenType: action.payload.tokenType,
            tokenId: action.payload.tokenId,
            l2TokenId: action.payload.l2TokenId,
            tokenName: action.payload.tokenName,
            tokenBalanceL1: action.payload.l1Balance,
            tokenBalanceL2: action.payload.l2Balance,
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
        tokenAddress: action.payload.tokenAddress,
        tokenType: action.payload.tokenType,
        tokenId: action.payload.tokenId,
        l2TokenId: action.payload.l2TokenId,
        tokenName: action.payload.tokenName,
        tokenBalanceL1: action.payload.l1Balance,
        tokenBalanceL2: action.payload.l2Balance,
      };
      Storage.tokensSet(action.payload.compressedPkd, oldTokenPool);
      return {
        ...state,
        tokenPool: oldTokenPool,
      };
    }

    case tokenActionTypes.TOKEN_DELETE: {
      const newTokenPool = [...state.tokenPool].filter(
        token => token.tokenAddress !== action.payload.activeTokenRowId,
      );
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
      };

    case tokenActionTypes.TOKEN_UNSELECT:
      return {
        ...state,
        activeTokenRowId: '',
      };

    default:
      return state;
  }
}

export default tokenReducer;
