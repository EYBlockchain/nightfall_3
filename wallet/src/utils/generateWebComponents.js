import React from 'react';
import ReactDOM from 'react-dom';
import reactToWebcomponent from 'react-to-webcomponent';
import BridgeComponent from '../components/BridgeComponent/index.tsx';
// import Transactions from '../components/Transactions/index.jsx';

const generateWebComponents = () => {
  // if (customElements.get('transactions-component') === undefined) {
  //   const TransactionEl = reactToWebcomponent(Transactions, React, ReactDOM);
  //   customElements.define('transactions-component', TransactionEl);
  // }

  if (customElements.get('bridge-component') === undefined) {
    const BridgeElement = reactToWebcomponent(BridgeComponent, React, ReactDOM);
    customElements.define('bridge-component', BridgeElement);
  }
};
// ignore unused exports
export default generateWebComponents;
