import React, { useEffect, useState } from 'react';
import { Route, Switch, Redirect, BrowserRouter } from 'react-router-dom';
import ReactDOM from 'react-dom';

import { NF3_GITHUB_ISSUES_URL } from '../constants';
import MainPage from './initialPage/index.jsx';
import Wallet from './wallet/index.jsx';
import Bridge from './bridge/index.jsx';
import { UserProvider } from '../hooks/User/index.jsx';
import TransactionPage from './transactionPage/index.jsx';
import Web3 from '../common-files/utils/web3';
import reactToWebcomponent from 'react-to-webcomponent';
import { BridgeComponent } from '../components/BridgeComponent/index.tsx';

export default function App() {
  // eslint-disable-next-line no-unused-vars
  const [isWeb3Connected, setIsWeb3Connected] = useState(false);

  useEffect(async () => {
    await Web3.connect();
    setIsWeb3Connected({
      isWeb3Connected: true,
    });
    //defineComponents();
  }, []);

  // function defineComponents() {
  //   customElements.define(
  //     'bridge-component',
  //     reactToWebcomponent(
  //       BridgeComponent, 
  //       React, 
  //       ReactDOM
  //     )
  //   )
  // }

  /*
   * TODO: for path /wallet and /bridge component should render when web3connect is complete
   * like implement a loader till web3connect is not complete
   * for example with blank page:
   *   const web3Boiler = <div>Web3 connection is pending</div>;
   *   '{isWeb3Connected ? <Route path="/wallet" render={() => <Wallet />} /> : web3Boiler}'
   *   instead of '<Route path="/wallet" render={() => <Wallet />} />'
   */
  return (
    <BrowserRouter>
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
            <Redirect to="/" />
          </Switch>          
        </React.Fragment>
      </UserProvider>
    </BrowserRouter>
  );
}
