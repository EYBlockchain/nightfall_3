// ignore unused exports default

import Web3 from 'web3';

const { ethereum } = global;

export default {
  connectedAccount: undefined,
  connection() {
    if (!this.web3) this.connect();
    return this.web3;
  },

  /**
   * Setup web3 with metamask provider
   * Note: function only supposed to call once
   */
  async connect() {
    if (!ethereum) {
      throw Error('MetaMask is not connected');
    }
    this.web3 = new Web3(ethereum);
    global.web3 = this.web3; // for now global.web3 is only set and not referenced anywhere

    [this.connectedAccount] = await ethereum.request({ method: 'eth_requestAccounts' });
    ethereum.on('accountsChanged', ([account]) => {
      this.connectedAccount = account;
    });

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
    if (!this.connectedAccount)
      [this.connectedAccount] = await ethereum.request({ method: 'eth_requestAccounts' });
    return this.connectedAccount;
  },

  signMessage(msg) {
    return this.web3.eth.personal.sign(msg, this.connectedAccount);
  },
};
