/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import Web3 from 'web3';

declare let window: any;

const loadWeb3 = async () => {
  if (window.web3) {
    window.web3 = new Web3(window.ethereum);
    // await window.ethereum.enable()
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    return;
  }

  if (window.web3) {
    window.web3 = new Web3(window.web3.currentProvider);
    return;
  }

  window.alert('Non-Ethereum browser detected. You should consider trying MetaMask!');
};

export default loadWeb3;
