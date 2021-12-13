/* ignore unused exports */
import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import logger from 'redux-logger';
import loginReducer from './login/login.reducer';
import tokenReducer from './token/token.reducer';
import txReducer from './transactions/transactions.reducer';
import errorReducer from './error/error.reducer';

function configureStore() {
  const store = createStore(
    combineReducers({
      login: loginReducer,
      token: tokenReducer,
      transactions: txReducer,
      error: errorReducer,
    }),
    applyMiddleware(thunk, logger),
  );

  return store;
}

export default configureStore;
