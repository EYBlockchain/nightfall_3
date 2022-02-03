import React from 'react';
import { Route, Redirect, Switch } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import * as Nf3 from 'nf3';

import Transactions from './transactions/transactions.view.jsx';
import Login from './login/login.view.jsx';
import Deposit from './zokrates/deposit.view.jsx';
import Withdraw from './zokrates/withdraw.view.jsx';
import Singletransfer from './zokrates/singletransfer.view.jsx';
import Doubletransfer from './zokrates/doubletransfer.view.jsx';

import { NF3_GITHUB_ISSUES_URL } from '../constants';
import * as loginActions from '../store/login/login.actions';
import MainPage from './initialPage/index.jsx';
import Wallet from './wallet/index.jsx';
import Bridge from './bridge/index.jsx';
import { UserProvider } from '../hooks/User/index.jsx';
import TransactionPage from './transactionPage/index.jsx';

function App({ onDeleteWallet }) {
  Nf3.Environment.setEnvironment(process.env.REACT_APP_ENVIRONMENT);

  // Detect page refresh
  React.useEffect(() => {
    window.addEventListener('beforeunload', () => {
      onDeleteWallet();
    });
  }, [onDeleteWallet]);

  // TODO:Detect network is online/offline

  // Detect accounts changed and chain changed on metamask
  React.useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', () => {
        onDeleteWallet();
      });
      window.ethereum.on('chainChanged', () => {
        onDeleteWallet();
      });
    }
  }, [onDeleteWallet]);

  return (
    <UserProvider>
      <React.Fragment>
        <Switch>
          <Route path="/login" render={() => <Login />} />
          <Route path="/" exact={true} render={() => <MainPage />} />
          <Route path="/transactions" render={() => <Transactions />} />
          <Route path="/wallet" render={() => <Wallet />} />
          <Route path="/bridge" render={() => <Bridge />} />
          <Route path="/transactionPage" render={() => <TransactionPage />} />
          <Route
            path="/issues"
            render={() => {
              window.location = NF3_GITHUB_ISSUES_URL;
            }}
          />
          <Route path="/deposit" render={() => <Deposit />} />
          <Route path="/withdraw" render={() => <Withdraw />} />
          <Route path="/singletransfer" render={() => <Singletransfer />} />
          <Route path="/doubletransfer" render={() => <Doubletransfer />} />
          <Redirect to="/" />
        </Switch>
      </React.Fragment>
    </UserProvider>
  );
}

App.propTypes = {
  onDeleteWallet: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({
  login: state.login,
});

const mapDispatchToProps = dispatch => ({
  onDeleteWallet: () => dispatch(loginActions.deleteWallet()),
});

export default connect(mapStateToProps, mapDispatchToProps)(App);
