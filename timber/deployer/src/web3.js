/**
@module web3.js
@desc
@author liju jose
*/

import Web3 from 'web3';
import config from 'config';

export default {
  connection() {
    return this.web3;
  },

  /**
   * Connects to web3 and then sets proper handlers for events
   */
  connect() {
    if (this.web3) return this.web3;

    console.log('\nBlockchain Connecting ...');
    const provider = new Web3.providers.WebsocketProvider(
      `${config.web3.host}:${config.web3.port}`,
      null,
      config.web3.options,
    );

    provider.on('error', console.error);
    provider.on('connect', () => console.log('\nBlockchain Connected ...'));
    provider.on('end', console.error);

    this.web3 = new Web3(provider);

    return this.web3;
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
};
