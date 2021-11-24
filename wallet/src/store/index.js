/* ignore unused exports */
import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import logger from 'redux-logger';
import loginReducer from './login/login.reducer';
import tokenReducer from './token/token.reducer';
import txReducer from './transactions/transactions.reducer';

function configureStore() {
  const store = createStore(
    combineReducers({
      login: loginReducer,
      token: tokenReducer,
      transactions: txReducer,
    }),
    applyMiddleware(thunk, logger),
  );

  return store;
}

export default configureStore;
