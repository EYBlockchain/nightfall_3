/* ignore unused exports */
import { tokenActionTypes } from './token.actions';
import tokens from '../../utils/tokens';

const initialState = {
  activeTokenRowId: '',
  maxTokenRowId: tokens.length,
  tokenPool: tokens,
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
        return {
          ...state,
          maxTokenRowId: state.maxTokenRowId + 1,
          tokenPool: [
            ...state.tokenPool,
            {
              tokenAddress: action.payload.tokenAddress,
              tokenType: action.payload.tokenType,
              tokenId: action.payload.tokenId,
              tokenBalanceL1: action.payload.l1Balance,
              tokenBalanceL2: action.payload.l2Balance,
              id: state.maxTokenRowId + 1,
            },
          ],
        };
      }

      // existing token -> Update
      oldTokenPool[objIndex] = {
        tokenAddress: action.payload.tokenAddress,
        tokenType: action.payload.tokenType,
        tokenId: action.payload.tokenId,
        tokenBalanceL1: action.payload.l1Balance,
        tokenBalanceL2: action.payload.l2Balance,
        id: oldTokenPool[objIndex].id,
      };
      return {
        ...state,
        tokenPool: oldTokenPool,
      };
    }

    case tokenActionTypes.TOKEN_DELETE:
      return {
        ...state,
      };

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
