// ignore unused exports default

import Web3 from 'web3';

const { ethereum } = global;

export default {
  connection() {
    if (!this.web3) this.connect();
    return this.web3;
  },

  /**
   * Setup web3 with metamask provider
   * Note: function only supposed to call once
   */
  connect() {
    console.log('Setting up web3 ...');
    if (!ethereum) {
      throw Error('MetaMask is not connected');
    }
    this.web3 = new Web3(ethereum);
    global.web3 = this.web3;

    return ethereum;
  },

  /**
   * Checks the status of connection
   *
   * @return {Boolean} - Resolves to true or false
   */
  isConnected() {
    if (this.web3) {
      return this.web3.eth.net.isListening();
    }
    return false;
  },

  // TODO: fix it - not working with the browser logic
  disconnect() {
    this.web3.currentProvider.connection.close();
  },

  // get account address to which MetaMask is connected
  async getAccount() {
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    return accounts[0];
  },
};
