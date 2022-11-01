/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from 'react';
import { Route, Switch, BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { NF3_GITHUB_ISSUES_URL } from '../../constants';
import Wallet from '../wallet/index.jsx';
import { UserProvider } from '../../hooks/User/index.jsx';
import TransactionPage from '../transactionPage/index.jsx';
import Web3 from '../../common-files/utils/web3';
import Bridge from '../bridge/index.jsx';
import { AccountProvider } from '../../hooks/Account/index.tsx';
import '../../../node_modules/react-toastify/dist/ReactToastify.css';
import Header from '../../components/Header/header.jsx';
import Sidebar from '../../components/SideBar';

export default function App() {
  const [isWeb3Connected, setIsWeb3Connected] = useState(false);

  useEffect(async () => {
    await Web3.connect();
    setIsWeb3Connected(true);
  }, []);

  return isWeb3Connected ? (
    <BrowserRouter>
      <ToastContainer />
      <UserProvider>
        <AccountProvider>
          <div className="app">
            {/* TODO: Find out why Header renders conditionally */}
            {process.env.REACT_APP_MODE === 'local' ? (
              <header className="app__header">
                <Header />
              </header>
            ) : null}

            <aside className="app__sidebar">
              <Sidebar />
            </aside>

            <div className="app__main">
              <Switch>
                <Route path="/" exact render={() => <Wallet />} />
                <Route path="/bridge" render={() => <Bridge />} />
                <Route path="/transactionPage" render={() => <TransactionPage />} />
                <Route
                  path="/issues"
                  render={() => {
                    window.location = NF3_GITHUB_ISSUES_URL;
                  }}
                />
              </Switch>
            </div>
          </div>
        </AccountProvider>
      </UserProvider>
    </BrowserRouter>
  ) : (
    <div>Web3 connection is pending</div>
  );
}
