/**
@module web3.js
@desc
@author liju jose
*/

import Web3 from 'web3';
import config from 'config';
import logger from './logger.mjs';

const { INFURA_PROJECT_SECRET } = process.env;

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

    let provider;
    if (config.ENABLE_TESTNET_DEPLOY) {
      if (!INFURA_PROJECT_SECRET) throw Error('env INFURA_PROJECT_SECRET not set');

      provider = new Web3.providers.WebsocketProvider(config.web3.url, {
        ...config.web3.options,
        headers: {
          authorization: `Basic ${Buffer.from(`:${INFURA_PROJECT_SECRET}`).toString('base64')}`,
        },
      });
    } else {
      provider = new Web3.providers.WebsocketProvider(config.web3.url, config.web3.options);
    }

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
