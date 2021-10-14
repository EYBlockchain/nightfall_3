import React from 'react';
import { Route, Redirect, Switch } from 'react-router-dom';

import Transactions from './transactions/transactions.view';
import Login from './login/login.view'
import { setEnvironment } from '../utils/lib/environment';
import { DEFAULT_ENVIRONMENT, NF3_GITHUB_ISSUES_URL } from '../constants'


function App({ }) {

  setEnvironment(DEFAULT_ENVIRONMENT, true);

  return (
    <React.Fragment>
      <Switch>
        <Route path="/login" render={() => <Login />} />
        <Route path="/transactions" render={() => <Transactions />} />
        <Route path="/issues" render={() => (window.location = NF3_GITHUB_ISSUES_URL)} />
        <Redirect to="/login" />
      </Switch>
    </React.Fragment>
  );
}

export default App;
