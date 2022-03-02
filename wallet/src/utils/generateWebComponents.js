import React from 'react';
import ReactDOM from 'react-dom';
import reactToWebcomponent from 'react-to-webcomponent';


import App from '../views/app.view.jsx'

const generateWebComponents = () => {
  // if (customElements.get('transactions-component') === undefined) {
  //   const TransactionEl = reactToWebcomponent(Transactions, React, ReactDOM);
  //   customElements.define('transactions-component', TransactionEl);
  // }

  // if (customElements.get('bridge-component') === undefined) {
  //   const BridgeElement = reactToWebcomponent(BridgeComponent, React, ReactDOM);
  //   customElements.define('bridge-component', BridgeElement);
  // }

  if (customElements.get('nightfall-app') === undefined) {
    const AppEl = reactToWebcomponent(App, React, ReactDOM);
    customElements.define('nightfall-app', AppEl);
  }

};
// ignore unused exports
export default generateWebComponents;
