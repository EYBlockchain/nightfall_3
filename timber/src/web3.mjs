/**
@module web3.js
@desc
@author liju jose
*/

import Web3 from 'web3';
import config from 'config';
import logger from './logger.mjs';

export default {
  connection() {
    return this.web3;
  },

  /**
   * Connects to web3 and then sets proper handlers for events
   */
  connect() {
    if (this.web3) return this.web3;

    logger.info('Blockchain Connecting ...');
    const provider = new Web3.providers.WebsocketProvider(
      `ws://${config.web3.host}:${config.web3.port}`,
      {
        timeout: 3600000,
        reconnect: {
          auto: true,
          delay: 5000, // ms
          maxAttempts: 120,
          onTimeout: false,
        },
      }, // set a 10 minute timeout
    );

    provider.on('error', err => logger.error(err));
    provider.on('connect', () => logger.info('Blockchain Connected ...'));
    provider.on('end', () => logger.error('Blockchain Disconnected'));

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
