import React from 'react';
import { Route, Switch } from 'react-router-dom';
import * as Nf3 from 'nf3';

import { NF3_GITHUB_ISSUES_URL } from '../constants';
import MainPage from './initialPage/index.jsx';
import Wallet from './wallet/index.jsx';
import Bridge from './bridge/index.jsx';
import { UserProvider } from '../hooks/User/index.jsx';
import TransactionPage from './transactionPage/index.jsx';

export default function App() {
  Nf3.Environment.setEnvironment(process.env.REACT_APP_ENVIRONMENT);

  return (
    <UserProvider>
      <React.Fragment>
        <Switch>
          <Route path="/" exact={true} render={() => <MainPage />} />
          <Route path="/wallet" render={() => <Wallet />} />
          <Route path="/bridge" render={() => <Bridge />} />
          <Route path="/transactionPage" render={() => <TransactionPage />} />
          <Route
            path="/issues"
            render={() => {
              window.location = NF3_GITHUB_ISSUES_URL;
            }}
          />
        </Switch>
      </React.Fragment>
    </UserProvider>
  );
}
